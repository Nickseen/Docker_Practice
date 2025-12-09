import os
import json
import logging
import asyncio
import aiohttp
import random
from aiohttp import web
from typing import Dict, List
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class KeyValueStore:
    
    def __init__(self):
        self.store: Dict[str, str] = {}
        self.lock = asyncio.Lock()
    
    async def get(self, key: str) -> str:
        async with self.lock:
            return self.store.get(key)
    
    async def set(self, key: str, value: str) -> None:
        async with self.lock:
            self.store[key] = value
    
    async def delete(self, key: str) -> bool:
        async with self.lock:
            if key in self.store:
                del self.store[key]
                return True
            return False
    
    async def get_all(self) -> Dict[str, str]:
        async with self.lock:
            return self.store.copy()


class ReplicationManager:
    
    def __init__(self, follower_urls: List[str], min_delay: float = 0.0, max_delay: float = 0.0):
        self.follower_urls = follower_urls
        self.session = None
        self.min_delay = min_delay
        self.max_delay = max_delay
    
    async def start(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=5)
        )
    
    async def stop(self):
        if self.session:
            await self.session.close()
    
    async def replicate_to_follower(self, follower_url: str, operation: Dict) -> bool:
        try:
            if self.max_delay > 0:
                delay = random.uniform(self.min_delay, self.max_delay)
                logger.info(f"Simulating network delay of {delay:.3f}s for {follower_url}")
                await asyncio.sleep(delay)
            
            async with self.session.post(
                f"{follower_url}/replicate",
                json=operation,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    logger.info(f"Successfully replicated to {follower_url}")
                    return True
                else:
                    logger.error(f"Failed to replicate to {follower_url}: {response.status}")
                    return False
        except Exception as e:
            logger.error(f"Error replicating to {follower_url}: {e}")
            return False
    
    async def replicate(self, operation: Dict) -> int:
        if not self.follower_urls:
            return 0
        
        tasks = [
            self.replicate_to_follower(url, operation)
            for url in self.follower_urls
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        success_count = sum(1 for r in results if r is True)
        logger.info(f"Replication completed: {success_count}/{len(self.follower_urls)} followers updated")
        return success_count


class KVServer:
    
    def __init__(self, is_leader: bool, port: int, follower_urls: List[str] = None, write_quorum: int = 0, min_delay: float = 0.0, max_delay: float = 0.0):
        self.is_leader = is_leader
        self.port = port
        self.store = KeyValueStore()
        self.replication_manager = None
        self.write_quorum = write_quorum
        
        if is_leader and follower_urls:
            self.replication_manager = ReplicationManager(follower_urls, min_delay, max_delay)
        
        self.app = web.Application()
        self._setup_routes()
    
    def _setup_routes(self):
        self.app.router.add_get('/health', self.health_check)
        self.app.router.add_get('/get/{key}', self.handle_get)
        self.app.router.add_post('/set', self.handle_set)
        self.app.router.add_delete('/delete/{key}', self.handle_delete)
        self.app.router.add_get('/all', self.handle_get_all)
        
        if not self.is_leader:
            self.app.router.add_post('/replicate', self.handle_replicate)
    
    async def health_check(self, request):
        return web.json_response({
            "status": "healthy",
            "role": "leader" if self.is_leader else "follower",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    async def handle_get(self, request):
        key = request.match_info['key']
        value = await self.store.get(key)
        
        if value is None:
            return web.json_response(
                {"error": "Key not found"},
                status=404
            )
        
        return web.json_response({
            "key": key,
            "value": value
        })
    
    async def handle_set(self, request):
        """Handle SET request (only leader accepts writes)."""
        if not self.is_leader:
            return web.json_response(
                {"error": "Only leader accepts writes"},
                status=403
            )
        
        try:
            data = await request.json()
            key = data.get('key')
            value = data.get('value')
            
            if not key or value is None:
                return web.json_response(
                    {"error": "Missing key or value"},
                    status=400
                )
            
            await self.store.set(key, value)
            
            replicated_count = 0
            if self.replication_manager:
                replicated_count = await self.replication_manager.replicate({
                    "operation": "set",
                    "key": key,
                    "value": value
                })
                
                if replicated_count < self.write_quorum:
                    logger.warning(f"Write quorum not met: {replicated_count}/{self.write_quorum}")
                    return web.json_response({
                        "error": "Write quorum not met",
                        "replicated": replicated_count,
                        "required": self.write_quorum
                    }, status=500)
            
            return web.json_response({
                "success": True,
                "key": key,
                "value": value,
                "replicated": replicated_count
            })
        
        except json.JSONDecodeError:
            return web.json_response(
                {"error": "Invalid JSON"},
                status=400
            )
    
    async def handle_delete(self, request):
        if not self.is_leader:
            return web.json_response(
                {"error": "Only leader accepts writes"},
                status=403
            )
        
        key = request.match_info['key']
        existed = await self.store.delete(key)
        
        replicated_count = 0
        if self.replication_manager:
            replicated_count = await self.replication_manager.replicate({
                "operation": "delete",
                "key": key
            })
            
            if replicated_count < self.write_quorum:
                logger.warning(f"Write quorum not met: {replicated_count}/{self.write_quorum}")
                return web.json_response({
                    "error": "Write quorum not met",
                    "replicated": replicated_count,
                    "required": self.write_quorum
                }, status=500)
        
        return web.json_response({
            "success": True,
            "key": key,
            "existed": existed,
            "replicated": replicated_count
        })
    
    async def handle_get_all(self, request):
        data = await self.store.get_all()
        return web.json_response({
            "data": data,
            "count": len(data)
        })
    
    async def handle_replicate(self, request):
        if self.is_leader:
            return web.json_response(
                {"error": "Leader does not accept replication"},
                status=403
            )
        
        try:
            operation = await request.json()
            op_type = operation.get('operation')
            key = operation.get('key')
            
            if op_type == 'set':
                value = operation.get('value')
                await self.store.set(key, value)
                logger.info(f"Replicated SET: {key}={value}")
            
            elif op_type == 'delete':
                await self.store.delete(key)
                logger.info(f"Replicated DELETE: {key}")
            
            else:
                return web.json_response(
                    {"error": "Unknown operation"},
                    status=400
                )
            
            return web.json_response({"success": True})
        
        except Exception as e:
            logger.error(f"Replication error: {e}")
            return web.json_response(
                {"error": str(e)},
                status=500
            )
    
    async def start_background_tasks(self, app):
        if self.replication_manager:
            await self.replication_manager.start()
    
    async def cleanup_background_tasks(self, app):
        if self.replication_manager:
            await self.replication_manager.stop()
    
    async def run(self):
        self.app.on_startup.append(self.start_background_tasks)
        self.app.on_cleanup.append(self.cleanup_background_tasks)
        
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, '0.0.0.0', self.port)
        
        logger.info(f"Starting {'LEADER' if self.is_leader else 'FOLLOWER'} on port {self.port}")
        await site.start()
        
        try:
            await asyncio.Event().wait()
        except KeyboardInterrupt:
            logger.info("Shutting down...")
        finally:
            await runner.cleanup()


def main():
    is_leader = os.getenv('IS_LEADER', 'false').lower() == 'true'
    port = int(os.getenv('PORT', '8080'))
    
    follower_urls = []
    write_quorum = 0
    min_delay = 0.0
    max_delay = 0.0
    
    if is_leader:
        followers_env = os.getenv('FOLLOWER_URLS', '')
        if followers_env:
            follower_urls = [url.strip() for url in followers_env.split(',') if url.strip()]
        
        write_quorum = int(os.getenv('WRITE_QUORUM', '0'))
        
        min_delay = float(os.getenv('MIN_DELAY', '0')) / 1000.0
        max_delay = float(os.getenv('MAX_DELAY', '0')) / 1000.0
    
    logger.info(f"Configuration: is_leader={is_leader}, port={port}")
    if follower_urls:
        logger.info(f"Follower URLs: {follower_urls}")
        logger.info(f"Write quorum: {write_quorum}")
        logger.info(f"Network delay simulation: [{min_delay * 1000:.0f}ms, {max_delay * 1000:.0f}ms]")
    
    server = KVServer(is_leader, port, follower_urls, write_quorum, min_delay, max_delay)
    asyncio.run(server.run())


if __name__ == '__main__':
    main()
