# Lab 2: Multithreaded HTTP File Server 🧵

## 📋 Lab Requirements Completed

✅ **Multithreaded server with thread pool**
✅ **Script for concurrent requests**  
✅ **Performance comparison (single vs multi-threaded)**  
✅ **Request counter with race condition demonstration**  
✅ **Thread-safe implementation with locks**  
✅ **Rate limiting by client IP (thread-safe)**  
✅ **Throughput comparison**

---

## 🎯 What You'll Learn

1. **Thread pools** - How to implement and use them
2. **Concurrent request handling** - Multiple clients served simultaneously  
3. **Race conditions** - What they are and how they occur
4. **Thread synchronization** - Using locks to prevent race conditions
5. **Rate limiting** - Controlling request rates per client
6. **Performance analysis** - Measuring and comparing server performance

---

## 🏗️ Project Structure

```
docker_practice/
├── file_server.py              # Lab 1: Single-threaded server
├── file_server_lab2.py         # Lab 2: Multithreaded server ⭐
├── benchmark_lab2.py           # Performance testing script ⭐
├── test_race_condition.py      # Race condition demonstration ⭐
├── Dockerfile.lab2             # Docker configuration for lab 2
├── docker-compose.lab2.yml     # Docker compose for lab 2
└── content/                    # Files to serve
    ├── index.html
    ├── images/
    └── books/
```

---

## 🚀 Quick Start Guide

### Method 1: Run Locally (Recommended for Testing)

```bash
# 1. Start multithreaded server with 1s delay
python3 file_server_lab2.py content/ --delay 1

# 2. In another terminal, run performance test
python3 benchmark_lab2.py

# 3. Open browser to see request counter
# http://localhost:8080/
```

### Method 2: Docker

```bash
# Build and start
docker-compose -f docker-compose.lab2.yml up --build

# View logs
docker-compose -f docker-compose.lab2.yml logs -f

# Stop
docker-compose -f docker-compose.lab2.yml down
```

---

## 📊 Lab Requirements & How to Complete Them

### Requirement 1: Make HTTP Server Multithreaded ✅

**Implementation:**
- Thread pool with 4 workers (configurable)
- Thread-safe queue for task distribution
- Each worker handles requests concurrently

**Test it:**
```bash
python3 file_server_lab2.py content/ --threads 4
```

**What to observe:**
- Open multiple browser tabs to http://localhost:8080/
- Watch server logs - multiple requests handled simultaneously
- Queue size shown in directory listing

---

### Requirement 2: Concurrent Request Script ✅

**Script:** `benchmark_lab2.py`

**Run it:**
```bash
python3 benchmark_lab2.py concurrent
```

**What it does:**
- Creates 10 clients simultaneously
- Each makes a request to the server
- Measures total time and individual response times
- Shows throughput (requests/second)

---

### Requirement 3: Add Delay & Compare Performance ✅

#### Step 1: Test Single-threaded Server (Lab 1)

```bash
# Terminal 1: Start single-threaded server
python3 file_server.py content/

# Terminal 2: Run benchmark
python3 benchmark_lab2.py comparison
# Follow the prompts
```

**Expected Result:**
```
Single-threaded (10 sequential requests with 1s delay each):
Time: ~10+ seconds
Throughput: ~1 request/second
```

#### Step 2: Test Multithreaded Server (Lab 2)

```bash
# Terminal 1: Start multithreaded server with delay
python3 file_server_lab2.py content/ --delay 1 --threads 4

# Terminal 2: Run benchmark (it will prompt you)
python3 benchmark_lab2.py comparison
```

**Expected Result:**
```
Multithreaded (10 concurrent requests with 1s delay each):
Time: ~3 seconds (with 4 threads)
Throughput: ~3-4 requests/second
Speedup: 3-4x faster! 🚀
```

#### Why the Difference?

**Single-threaded:**
```
Request 1 [========] 1s
Request 2           [========] 1s
Request 3                     [========] 1s
...
Total: 10 seconds
```

**Multithreaded (4 threads):**
```
Request 1 [========] 1s
Request 2 [========] 1s  } All at same time!
Request 3 [========] 1s
Request 4 [========] 1s

Request 5 [========] 1s
Request 6 [========] 1s  } Next batch
Request 7 [========] 1s
Request 8 [========] 1s

Request 9 [========] 1s  } Final batch
Request 10[========] 1s

Total: ~3 seconds (3 batches of 4)
```

---

### Requirement 4: Request Counter Feature ✅

**Feature:** Tracks how many times each file/directory has been requested

**View it:**
1. Start server:
   ```bash
   python3 file_server_lab2.py content/
   ```

2. Open http://localhost:8080/

3. Click on different files and directories

4. Return to root - you'll see request counts for each item!

**Screenshot of what you'll see:**
```
Directory listing for /

📊 Total Requests: 42   ⛔ Blocked: 0   🧵 Queue: 0

Name                Type        Requests
📁 ../              Directory   [5]
📁 images/          Directory   [12]
📁 books/           Directory   [8]
📄 index.html       File        [15]
```

---

### Requirement 5: Race Condition Demonstration ✅

#### Part A: Show the Race Condition (Naive Implementation)

**What is a race condition?**

Multiple threads trying to update the same variable:

```python
# Thread 1 reads count = 5
# Thread 2 reads count = 5  ← Both read same value!
# Thread 1 writes count = 6
# Thread 2 writes count = 6 ← Lost one increment! Bug! 💥
```

**Demonstrate it:**

```bash
# Terminal 1: Start server WITHOUT locks
python3 file_server_lab2.py content/ --no-locks

# Terminal 2: Run race condition test
python3 test_race_condition.py
```

**Expected output:**
```
Expected counter value: 100
Actual counter value:   87    ← Lost 13 increments!

❌ RACE CONDITION DETECTED!
Lost increments: 13
```

**Why it happens:**
- `--no-locks` disables thread safety
- Code intentionally has `time.sleep(0.001)` to force interleaving
- Multiple threads read/write without coordination
- Some increments are lost!

#### Part B: Fix with Locks (Thread-safe Implementation)

**How locks fix it:**

```python
# Thread 1 acquires lock
# Thread 1 reads count = 5
# Thread 1 writes count = 6
# Thread 1 releases lock
# Thread 2 acquires lock (was waiting)
# Thread 2 reads count = 6  ← Correct value!
# Thread 2 writes count = 7
# Thread 2 releases lock
```

**Demonstrate the fix:**

```bash
# Terminal 1: Start server WITH locks (default)
python3 file_server_lab2.py content/

# Terminal 2: Run race condition test
python3 test_race_condition.py
```

**Expected output:**
```
Expected counter value: 100
Actual counter value:   100   ← Perfect! ✅

✅ SUCCESS! Counter is correct.
No race condition detected! 🎉
```

**Code comparison:**

```python
# WITHOUT locks (race condition)
def _increment_counter(self, path):
    current_value = self.request_counter[path]
    time.sleep(0.001)  # Simulates delay
    self.request_counter[path] = current_value + 1  # ❌ Unsafe!

# WITH locks (thread-safe)
def _increment_counter(self, path):
    with self.counter_lock:  # ✅ Only one thread at a time!
        current_value = self.request_counter[path]
        time.sleep(0.001)
        self.request_counter[path] = current_value + 1
```

---

### Requirement 6: Rate Limiting by Client IP ✅

**Feature:** Limits each client to 5 requests/second

**How it works:**
1. Track request timestamps for each IP address
2. Before processing request, check recent requests
3. If >5 requests in last second → reject with HTTP 429
4. Otherwise → allow request and add timestamp

**Thread-safe implementation:**
```python
def _check_rate_limit(self, client_ip):
    current_time = time.time()
    
    with self.rate_limit_lock:  # Thread-safe!
        timestamps = self.ip_requests[client_ip]
        timestamps = [ts for ts in timestamps if current_time - ts < 1.0]
        
        if len(timestamps) >= self.rate_limit:
            return False  # Rate limited!
        
        timestamps.append(current_time)
        self.ip_requests[client_ip] = timestamps
        return True
```

**Test it:**

```bash
# Terminal 1: Start server with rate limiting
python3 file_server_lab2.py content/ --rate-limit 5

# Terminal 2: Make rapid requests
python3 benchmark_lab2.py rate-limit
```

**Expected output:**
```
🔥 Rate Limiting Test
Target: 10 requests/second
Duration: 5 seconds

📊 Rate Limiting Results:
Total requests: 50
Successful (200): 25
Blocked (429): 25    ← Half blocked by rate limiter!
Actual rate: 10.00 req/s
Success rate: 5.00 req/s  ← Limited to 5 req/s ✅
```

---

### Requirement 7: Throughput Comparison ✅

**Compare servers with and without rate limiting:**

#### Without Rate Limiting:

```bash
python3 file_server_lab2.py content/ --threads 4
python3 benchmark_lab2.py concurrent
```

**Result:**
```
📊 Throughput: 8.5 requests/second
✅ All requests successful
```

#### With Rate Limiting:

```bash
python3 file_server_lab2.py content/ --threads 4 --rate-limit 5
python3 benchmark_lab2.py rate-limit
```

**Result:**
```
📊 Throughput: 5.0 requests/second
⛔ Excess requests blocked (HTTP 429)
```

**Analysis:**
- Without rate limiting: Limited only by thread pool size and network
- With rate limiting: Hard cap at 5 req/s per IP address
- Trade-off: Fairness and server protection vs throughput

---

## 🎓 Understanding the Implementation

### 1. Thread Pool Architecture

```
Main Thread (Server)
    │
    ├─ Accepts connections
    │
    └─ Submits to queue
        │
        ▼
    Task Queue [R1][R2][R3][R4]...
        │
        ├─────────┬─────────┬─────────┐
        ▼         ▼         ▼         ▼
    Worker 1  Worker 2  Worker 3  Worker 4
     (idle)   (busy)    (busy)    (idle)
```

**Key Components:**

1. **ThreadPool class:**
   - Creates fixed number of worker threads
   - Maintains a thread-safe queue
   - Distributes work to available workers

2. **Worker threads:**
   - Continuously run in background
   - Wait for tasks from queue
   - Process task and go back to waiting

3. **Task queue:**
   - Thread-safe `Queue()` from Python
   - FIFO (First In, First Out)
   - Blocks workers when empty

### 2. Race Condition Explained

**The Problem:**

```python
# Two threads executing simultaneously:

Thread 1:                    Thread 2:
read counter (value=10)
                             read counter (value=10)
increment (11)
                             increment (11)
write counter = 11
                             write counter = 11  ← Overwrites!

# Expected: 12
# Actual: 11
# Lost: 1 increment
```

**The Solution:**

```python
# Using a lock:

Thread 1:                    Thread 2:
acquire lock
read counter (value=10)
increment (11)
write counter = 11
release lock
                             acquire lock (was blocked)
                             read counter (value=11)
                             increment (12)
                             write counter = 12
                             release lock

# Expected: 12
# Actual: 12 ✅
```

### 3. Rate Limiting Algorithm

```python
# For each request from IP 192.168.1.100:

1. Get current time: 12:00:05.500

2. Get timestamps for this IP:
   [12:00:04.600, 12:00:04.800, 12:00:05.200, 12:00:05.400]

3. Filter out old timestamps (>1 second ago):
   [12:00:04.600, 12:00:04.800, 12:00:05.200, 12:00:05.400]
   All within 1 second! Count = 4

4. Check against limit (5 req/s):
   4 < 5 ✅ Allow request!

5. Add current timestamp:
   [12:00:04.600, 12:00:04.800, 12:00:05.200, 12:00:05.400, 12:00:05.500]

# Next request at 12:00:05.600:
# Count = 5, Check: 5 < 5 ❌ Reject! (429 Too Many Requests)

# Request at 12:00:06.100:
# Old timestamps removed: [12:00:05.400, 12:00:05.500, 12:00:06.100]
# Count = 3, Check: 3 < 5 ✅ Allow!
```

---

## 🧪 Complete Testing Checklist

### Test 1: Basic Functionality
- [ ] Start server: `python3 file_server_lab2.py content/`
- [ ] Open http://localhost:8080/ in browser
- [ ] Verify files are served correctly
- [ ] Check request counter appears in directory listing

### Test 2: Concurrent Performance
- [ ] Start server with delay: `python3 file_server_lab2.py content/ --delay 1`
- [ ] Run: `python3 benchmark_lab2.py concurrent`
- [ ] Verify 10 requests complete in ~3 seconds (not 10 seconds)
- [ ] Check throughput is 3-4 req/s

### Test 3: Single vs Multithreaded Comparison
- [ ] Start Lab 1 server: `python3 file_server.py content/`
- [ ] Run: `python3 benchmark_lab2.py comparison`
- [ ] Note single-threaded time (~10s)
- [ ] Switch to Lab 2 server with delay
- [ ] Note multithreaded time (~3s)
- [ ] Verify speedup of 3-4x

### Test 4: Race Condition - Without Locks
- [ ] Start server: `python3 file_server_lab2.py content/ --no-locks`
- [ ] Run: `python3 test_race_condition.py`
- [ ] Follow prompts for Test 1
- [ ] Verify some increments are lost (counter < 100)
- [ ] Screenshot the race condition result

### Test 5: Race Condition - With Locks
- [ ] Start server: `python3 file_server_lab2.py content/`
- [ ] Run test again (Test 2 in prompt)
- [ ] Verify all increments counted (counter = 100)
- [ ] Screenshot the fixed result

### Test 6: Rate Limiting
- [ ] Start server: `python3 file_server_lab2.py content/ --rate-limit 5`
- [ ] Run: `python3 benchmark_lab2.py rate-limit`
- [ ] Verify ~50% of rapid requests are blocked (429 errors)
- [ ] Check successful rate is ~5 req/s

### Test 7: Docker Deployment
- [ ] Build: `docker-compose -f docker-compose.lab2.yml build`
- [ ] Start: `docker-compose -f docker-compose.lab2.yml up`
- [ ] Test from host machine
- [ ] Verify it works the same as local

---

## 📈 Expected Results Summary

| Test | Configuration | Requests | Expected Time | Expected Throughput |
|------|---------------|----------|---------------|---------------------|
| Single-threaded | Lab 1, 1s delay | 10 sequential | ~10 seconds | ~1 req/s |
| Multithreaded (2 threads) | Lab 2, 1s delay | 10 concurrent | ~5 seconds | ~2 req/s |
| Multithreaded (4 threads) | Lab 2, 1s delay | 10 concurrent | ~3 seconds | ~3-4 req/s |
| Multithreaded (8 threads) | Lab 2, 1s delay | 10 concurrent | ~2 seconds | ~5 req/s |
| Race condition (no locks) | --no-locks flag | 100 concurrent | Lost increments | Counter < 100 |
| Thread-safe (with locks) | Default | 100 concurrent | All counted | Counter = 100 |
| Rate limiting | --rate-limit 5 | 10 req/s | 50% blocked | 5 req/s success |

---

## 🎨 Command Reference

### Server Commands

```bash
# Basic multithreaded server
python3 file_server_lab2.py content/

# With custom thread count
python3 file_server_lab2.py content/ --threads 8

# With work delay (for testing)
python3 file_server_lab2.py content/ --delay 1

# Race condition demonstration (no locks)
python3 file_server_lab2.py content/ --no-locks

# With rate limiting
python3 file_server_lab2.py content/ --rate-limit 5

# All options combined
python3 file_server_lab2.py content/ --threads 4 --delay 1 --rate-limit 5
```

### Testing Commands

```bash
# Full comparison test (follow prompts)
python3 benchmark_lab2.py comparison

# Just concurrent requests
python3 benchmark_lab2.py concurrent

# Rate limiting test
python3 benchmark_lab2.py rate-limit

# Race condition demonstration
python3 test_race_condition.py

# Help
python3 benchmark_lab2.py --help
```

### Docker Commands

```bash
# Start default configuration
docker-compose -f docker-compose.lab2.yml up

# Start with build
docker-compose -f docker-compose.lab2.yml up --build

# Start in background
docker-compose -f docker-compose.lab2.yml up -d

# View logs
docker-compose -f docker-compose.lab2.yml logs -f

# Stop
docker-compose -f docker-compose.lab2.yml down

# Start race condition demo (port 8081)
docker-compose -f docker-compose.lab2.yml --profile race-condition up

# Start rate limiting demo (port 8082)
docker-compose -f docker-compose.lab2.yml --profile rate-limit up
```

---

## 🐛 Troubleshooting

### "Address already in use"
```bash
# Find process using port 8080
lsof -i :8080
# or
netstat -tulpn | grep 8080

# Kill the process
kill -9 <PID>
```

### "Server not responding" in tests
- Make sure server is actually running
- Check it's on port 8080
- Test with browser first: http://localhost:8080/

### Race condition not showing
- Make sure using `--no-locks` flag
- Try increasing concurrent requests: modify script
- The sleep delay (0.001s) might need adjustment on fast systems

### Rate limiting not working
- Verify `--rate-limit` flag is used
- Check you're making more than 5 req/s
- Try lower limit like `--rate-limit 2` for easier testing

### Docker build fails
```bash
# Clean up old builds
docker-compose -f docker-compose.lab2.yml down
docker system prune -a

# Rebuild
docker-compose -f docker-compose.lab2.yml build --no-cache
```

---

## 📚 Key Concepts Learned

### 1. Thread Pools
- **Why:** Reuse threads instead of creating new ones per request
- **Benefits:** Lower overhead, controlled concurrency, better performance
- **When to use:** I/O-bound applications (web servers, databases)

### 2. Concurrent Programming
- **Challenge:** Multiple threads accessing shared resources
- **Solution:** Synchronization primitives (locks, semaphores)
- **Trade-off:** Safety vs performance

### 3. Race Conditions
- **Definition:** Bug where outcome depends on timing of threads
- **Detection:** Non-deterministic behavior, lost updates
- **Prevention:** Locks, atomic operations, thread-safe data structures

### 4. Rate Limiting
- **Purpose:** Protect server from abuse, ensure fair resource distribution
- **Implementation:** Sliding window with timestamps
- **Considerations:** Per-IP, per-user, per-API key

### 5. Performance Metrics
- **Throughput:** Requests per second
- **Latency:** Time per request
- **Speedup:** Improvement ratio (serial time / parallel time)
- **Efficiency:** Speedup / number of threads

---

## 🎯 Lab Report Template

Use this template for your lab report:

```markdown
# Lab 2: Multithreaded HTTP File Server

## Student: [Your Name]
## Date: [Date]

## 1. Implementation

### 1.1 Thread Pool
- Number of worker threads: [e.g., 4]
- Queue type: [e.g., Python Queue (thread-safe)]
- Worker behavior: [describe briefly]

### 1.2 Request Counter
- Data structure: [e.g., defaultdict(int)]
- Thread safety mechanism: [e.g., threading.Lock()]

### 1.3 Rate Limiting
- Algorithm: [e.g., Sliding window]
- Limit: [e.g., 5 req/s per IP]
- Thread safety: [e.g., separate lock]

## 2. Testing Results

### 2.1 Performance Comparison

| Server Type | Config | Requests | Time | Throughput |
|-------------|--------|----------|------|------------|
| Single-threaded | Lab 1 + 1s delay | 10 | [X]s | [Y] req/s |
| Multithreaded | Lab 2 + 1s delay + 4 threads | 10 | [X]s | [Y] req/s |

**Speedup:** [X]x
**Analysis:** [Your analysis]

### 2.2 Race Condition Demonstration

**Without locks:**
- Expected count: 100
- Actual count: [X]
- Lost increments: [Y]
- Screenshot: [Include]

**With locks:**
- Expected count: 100
- Actual count: 100
- Lost increments: 0
- Screenshot: [Include]

### 2.3 Rate Limiting

- Configuration: 5 req/s limit
- Test duration: 5 seconds at 10 req/s
- Total requests: [X]
- Successful: [Y]
- Blocked: [Z]
- Effective rate: [W] req/s

## 3. Analysis

### 3.1 Why Multithreading Improves Performance
[Your explanation]

### 3.2 Race Condition Explanation
[Explain what happened and why]

### 3.3 Lock Performance Impact
[Discuss overhead of synchronization]

## 4. Conclusion
[Summary of what you learned]
```

---

## 🏆 Bonus Challenges

1. **Dynamic Thread Pool:**
   - Adjust thread count based on load
   - Add threads when queue grows
   - Remove threads when idle

2. **Advanced Rate Limiting:**
   - Different limits for different file types
   - Burst allowance (allow short spikes)
   - Per-user authentication and quotas

3. **Connection Pooling:**
   - Reuse client connections (HTTP Keep-Alive)
   - Connection limits per IP

4. **Performance Monitoring:**
   - Real-time dashboard showing:
     - Active threads
     - Queue size
     - Request rate
     - Response times

5. **Load Testing:**
   - Use `ab` (Apache Bench) or `wrk`
   - Find maximum throughput
   - Identify bottlenecks

---

## 📖 Further Reading

- [Python Threading Documentation](https://docs.python.org/3/library/threading.html)
- [Thread Pools in Python](https://docs.python.org/3/library/concurrent.futures.html)
- [Race Conditions and Deadlocks](https://en.wikipedia.org/wiki/Race_condition)
- [Rate Limiting Algorithms](https://en.wikipedia.org/wiki/Rate_limiting)
- [Amdahl's Law](https://en.wikipedia.org/wiki/Amdahl%27s_law) (parallel computing limits)

---

## ✅ Lab Completion Checklist

- [ ] Implemented multithreaded server with thread pool
- [ ] Added 1 second delay to simulate work
- [ ] Created concurrent request testing script
- [ ] Compared single-threaded vs multithreaded performance
- [ ] Measured time for 10 concurrent requests (both servers)
- [ ] Implemented request counter feature
- [ ] Demonstrated race condition (without locks)
- [ ] Fixed race condition (with locks)
- [ ] Implemented thread-safe rate limiting
- [ ] Compared throughput with/without rate limiting
- [ ] Tested with Docker
- [ ] Documented all tests with screenshots
- [ ] Completed lab report

---

**🎉 Congratulations on completing Lab 2!**

You now understand:
- ✅ Thread pools and concurrent programming
- ✅ Race conditions and how to prevent them
- ✅ Thread synchronization with locks
- ✅ Rate limiting and fairness
- ✅ Performance analysis and measurement

**Next steps:** Consider implementing the bonus challenges or moving to Lab 3!
