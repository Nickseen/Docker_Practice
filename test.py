import asyncio
import aiohttp
import subprocess
import time
import statistics
from typing import List, Dict, Tuple
import matplotlib.pyplot as plt


class KVStoreTest:
    
    def __init__(self, leader_url: str, follower_urls: List[str]):
        self.leader_url = leader_url
        self.follower_urls = follower_urls
        self.session = None
    
    async def start(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=60)
        )
    
    async def stop(self):
        if self.session:
            await self.session.close()
    
    async def write_key(self, key: str, value: str) -> Tuple[bool, float]:
        start_time = time.time()
        try:
            async with self.session.post(
                f"{self.leader_url}/set",
                json={"key": key, "value": value},
                headers={"Content-Type": "application/json"}
            ) as response:
                latency = time.time() - start_time
                await response.json()
                return response.status == 200, latency
        except asyncio.CancelledError:
            raise
        except Exception as e:
            latency = time.time() - start_time
            return False, latency
    
    async def get_all_data(self, url: str) -> Dict[str, str]:
        try:
            async with self.session.get(f"{url}/all") as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("data", {})
        except:
            pass
        return {}
    
    async def perform_writes(self, keys: List[str]) -> List[Tuple[bool, float]]:
        results = []
        
        all_tasks = []
        for i in range(10):
            for key in keys:
                value = f"value_{key}_{i}"
                all_tasks.append((key, value))
        
        print(f"  Performing {len(all_tasks)} writes in batches of 10...")
        
        batch_size = 10
        for i in range(0, len(all_tasks), batch_size):
            batch = all_tasks[i:i + batch_size]
            tasks = [self.write_key(key, value) for key, value in batch]
            batch_results = await asyncio.gather(*tasks)
            results.extend(batch_results)
            await asyncio.sleep(0.05)
        
        return results
    
    async def verify_consistency(self, keys: List[str]) -> Dict:
        print("\n" + "="*80)
        print("DATA CONSISTENCY CHECK")
        print("="*80)
        
        await asyncio.sleep(2)
        
        leader_data = await self.get_all_data(self.leader_url)
        print(f"Leader: {len(leader_data)} keys")
        
        mismatches = []
        for i, follower_url in enumerate(self.follower_urls, 1):
            follower_data = await self.get_all_data(follower_url)
            print(f"Follower {i}: {len(follower_data)} keys", end=" ")
            
            for key in keys:
                leader_val = leader_data.get(key)
                follower_val = follower_data.get(key)
                if leader_val != follower_val:
                    mismatches.append({
                        "follower": i,
                        "key": key,
                        "leader": leader_val,
                        "follower": follower_val
                    })
            
            if not any(m["follower"] == i for m in mismatches):
                print("✅")
            else:
                print("❌")
        
        return {"mismatches": mismatches, "leader_data": leader_data}
    
    def change_quorum(self, quorum: int):
        print(f"\n{'='*80}")
        print(f"Configuring WRITE_QUORUM={quorum}")
        print("="*80)
        
        with open("docker-compose.yml", 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        for i, line in enumerate(lines):
            if 'WRITE_QUORUM=' in line:
                indent = len(line) - len(line.lstrip())
                lines[i] = ' ' * indent + f'- WRITE_QUORUM={quorum}\n'
                break
        
        with open("docker-compose.yml", 'w', encoding='utf-8') as f:
            f.writelines(lines)
        
        print(f"  Updated docker-compose.yml")
        
        print(f"  Restarting leader container...")
        subprocess.run(['docker-compose', 'stop', 'leader'], 
                      capture_output=True, shell=True)
        subprocess.run(['docker-compose', 'up', '-d', 'leader'], 
                      capture_output=True, shell=True)
        
        print(f"  Waiting for leader to be ready...")
        time.sleep(8)
        print(f"  ✅ Ready with WRITE_QUORUM={quorum}")


async def run_test():
    
    leader_url = "http://localhost:8080"
    follower_urls = [
        "http://localhost:8081",
        "http://localhost:8082",
        "http://localhost:8083",
        "http://localhost:8084",
        "http://localhost:8085",
    ]
    
    keys = [f"key_{i}" for i in range(10)]
    quorum_values = [1, 2, 3, 4, 5]
    
    print("="*80)
    print("DISTRIBUTED KV STORE - INTEGRATION TEST")
    print("="*80)
    print(f"Leader: {leader_url}")
    print(f"Followers: {len(follower_urls)}")
    print(f"Test keys: {keys}")
    print(f"Quorum values: {quorum_values}")
    print(f"Total writes per quorum: {len(keys)} keys × 10 writes = {len(keys) * 10}")
    
    test = KVStoreTest(leader_url, follower_urls)
    await test.start()
    
    results = {}
    
    try:
        for quorum in quorum_values:
            test.change_quorum(quorum)
            
            write_results = await test.perform_writes(keys)
            
            successful = [r for r in write_results if r[0]]
            failed = [r for r in write_results if not r[0]]
            latencies = [r[1] for r in successful]
            
            avg_latency = statistics.mean(latencies) if latencies else 0
            
            results[quorum] = {
                "successful": len(successful),
                "failed": len(failed),
                "avg_latency_ms": avg_latency * 1000,
                "min_latency_ms": min(latencies) * 1000 if latencies else 0,
                "max_latency_ms": max(latencies) * 1000 if latencies else 0,
            }
            
            print(f"\n  Results:")
            print(f"    Successful: {len(successful)}/{len(write_results)}")
            print(f"    Failed: {len(failed)}")
            print(f"    Avg latency: {avg_latency*1000:.2f}ms")
            print(f"    Min latency: {min(latencies)*1000:.2f}ms" if latencies else "")
            print(f"    Max latency: {max(latencies)*1000:.2f}ms" if latencies else "")
        
        consistency = await test.verify_consistency(keys)
        
        print("\n" + "="*80)
        print("PERFORMANCE SUMMARY: Write Quorum vs. Average Latency")
        print("="*80)
        
        quorums = sorted(results.keys())
        avg_latencies = [results[q]['avg_latency_ms'] for q in quorums]
        
        print("\n┌─────────┬──────────────┬──────────────┬──────────────┬──────────┐")
        print("│ Quorum  │ Avg Latency  │ Min Latency  │ Max Latency  │ Success  │")
        print("├─────────┼──────────────┼──────────────┼──────────────┼──────────┤")
        
        for q in quorums:
            r = results[q]
            success_rate = (r['successful'] / (r['successful'] + r['failed']) * 100) if (r['successful'] + r['failed']) > 0 else 0
            print(f"│    {q}    │  {r['avg_latency_ms']:>8.2f}ms  │  {r['min_latency_ms']:>8.2f}ms  │  {r['max_latency_ms']:>8.2f}ms  │  {success_rate:>5.1f}%  │")
        
        print("└─────────┴──────────────┴──────────────┴──────────────┴──────────┘")
        
        # Visual bar chart in console
        print("\n" + "="*80)
        print("VISUAL COMPARISON (Average Latency)")
        print("="*80)
        
        max_latency = max(avg_latencies)
        bar_width = 60  # characters
        
        for q, lat in zip(quorums, avg_latencies):
            bar_length = int((lat / max_latency) * bar_width) if max_latency > 0 else 0
            bar = "█" * bar_length
            print(f"Quorum {q}: {bar} {lat:.2f}ms")
        
        print("\n" + "="*80)
        print("GENERATING PLOT FILE")
        print("="*80)
        
        plt.figure(figsize=(10, 6))
        plt.plot(quorums, avg_latencies, marker='o', linewidth=2, markersize=10, color='#2E86AB')
        plt.xlabel('Write Quorum', fontsize=14)
        plt.ylabel('Average Latency (ms)', fontsize=14)
        plt.title('Write Quorum vs. Average Write Latency', fontsize=16, fontweight='bold')
        plt.grid(True, alpha=0.3)
        plt.xticks(quorums)
        
        for q, lat in zip(quorums, avg_latencies):
            plt.text(q, lat + 20, f'{lat:.1f}ms', ha='center', fontsize=10)
        
        plt.tight_layout()
        plt.savefig('quorum_vs_latency.png', dpi=300, bbox_inches='tight')
        print("✅ Plot saved as 'quorum_vs_latency.png'")
        
        print("\n" + "="*80)
        print("RESULTS EXPLANATION")
        print("="*80)
        

        
        print("\n📝 DATA CONSISTENCY:")
        print("-" * 80)
        
        if consistency["mismatches"]:
            print(f"❌ Found {len(consistency['mismatches'])} inconsistencies\n")
            for m in consistency["mismatches"][:5]:
                print(f"  Follower {m['follower']}, key '{m['key']}':")
                print(f"    Leader: {m['leader']}")
                print(f"    Follower: {m['follower']}")
        else:
            print("✅ Perfect consistency - all replicas match leader!")
        
        print("\n" + "="*80)
        print("✅ TEST COMPLETED")
        print("="*80)
        
    finally:
        await test.stop()


if __name__ == "__main__":
    asyncio.run(run_test())
