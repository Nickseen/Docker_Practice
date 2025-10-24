# Lab 2: Multithreaded HTTP File Server

![Python Version](https://img.shields.io/badge/python-3.9-blue.svg)
![Docker](https://img.shields.io/badge/docker-enabled-2496ED?logo=docker)
![Threading](https://img.shields.io/badge/threading-enabled-green.svg)

**Student:** Nicolai Petcov 

**Course:** Network Programming

**Date:** 25/10/2025

A multithreaded HTTP file server demonstrating concurrent programming, race conditions, thread synchronization, and rate limiting.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Lab Requirements](#lab-requirements)
3. [Part 1: Performance Comparison](#part-1-performance-comparison)
4. [Part 2: Hit Counter and Race Condition](#part-2-hit-counter-and-race-condition)
5. [Part 3: Rate Limiting](#part-3-rate-limiting)
6. [Screenshot Checklist](#screenshot-checklist)
7. [Conclusion](#conclusion)

---

## Overview

This lab demonstrates the implementation of a **multithreaded HTTP file server** with:
- ✅ Thread pool for concurrent request handling
- ✅ Request counter with race condition demonstration
- ✅ Thread-safe implementation using locks
- ✅ Rate limiting by client IP address

**Key Technologies:** Python 3, Threading, Socket Programming, HTTP/1.1

---

## Lab Requirements

**There are three parts in this lab. Include screenshots for each item:**

### Part 1: Performance Comparison
- Show how you send 10 requests to the single-threaded server and how long it takes
- Show how you send 10 requests to the multi-threaded server and how long it takes
- Compare performance and demonstrate speedup

### Part 2: Hit Counter and Race Condition
- Show how you trigger a race condition
- Show the code responsible for it (max. 4 lines)
- Show the fixed code

### Part 3: Rate Limiting
- Show how you spam requests (specify Requests/second)
- Show the response statistics (successful R/s, denied R/s)
- Show how it is aware of IPs (spam requests from another IP, and show how another IP still can send requests successfully)

---

## Part 1: Performance Comparison

**Objective:** Compare performance between single-threaded and multi-threaded servers with 10 concurrent requests.

### 1.1 Single-Threaded Server Test

**Commands:**
```bash
# Terminal 1: Start single-threaded server
python3 file_server.py content/

# Terminal 2: Run benchmark
python3 benchmark_lab2.py comparison
# When prompted, select Test 1 (single-threaded)
```

**📸 SCREENSHOT 1.1 - Single-threaded Performance**

![Screenshot 1.1](source/1.1_single_threaded.png) - Terminal showing benchmark output

Capture the benchmark output showing:
- Test description: "Testing single-threaded server (Lab 1)..."
- Individual request times (each ~1 second)
- **Total time:** ~10+ seconds
- **Throughput:** ~0.96 requests/second

**Expected output:**
```
📊 PERFORMANCE COMPARISON TEST

=== Test 1: Single-threaded Server ===
Make sure Lab 1 server is running with delay:
  python3 file_server.py content/

Testing single-threaded server (Lab 1)...

Individual request times:
  Request 1: 1.05s
  Request 2: 1.04s
  Request 3: 1.05s
  Request 4: 1.04s
  Request 5: 1.05s
  Request 6: 1.04s
  Request 7: 1.05s
  Request 8: 1.04s
  Request 9: 1.05s
  Request 10: 1.04s

Total time: 10.45 seconds
Throughput: 0.96 requests/second
```

**Explanation:** Single-threaded server processes requests **sequentially** (one after another), so 10 requests × 1 second = 10 seconds total.

---

### 1.2 Multi-Threaded Server Test

**Commands:**
```bash
# Stop single-threaded server (Ctrl+C in Terminal 1)

# Terminal 1: Start multi-threaded server with delay
python3 file_server_lab2.py content/ --delay 1 --threads 4

# Terminal 2: Run benchmark
python3 benchmark_lab2.py comparison
# When prompted, select Test 2 (multi-threaded)
```

**📸 SCREENSHOT 1.2 - Multi-threaded Performance**

![Screenshot 1.2](source/1.2_multi_threaded.png)

Capture the benchmark output showing:
- Test description: "Testing multi-threaded server (Lab 2)..."
- Individual request times (grouped in batches)
- **Total time:** ~2.5-3 seconds
- **Throughput:** ~3.17 requests/second
- **Speedup:** ~3.3x faster!

**Expected output:**
```
=== Test 2: Multi-threaded Server ===
Make sure Lab 2 server is running with delay:
  python3 file_server_lab2.py content/ --delay 1 --threads 4

Testing multi-threaded server (Lab 2)...

Individual request times:
  Request 1: 1.02s    ┐
  Request 2: 1.02s    │ Batch 1 (parallel)
  Request 3: 1.02s    │
  Request 4: 1.02s    ┘
  Request 5: 2.05s    ┐
  Request 6: 2.05s    │ Batch 2 (parallel)
  Request 7: 2.05s    │
  Request 8: 2.05s    ┘
  Request 9: 3.08s    ┐
  Request 10: 3.08s   ┘ Batch 3 (parallel)

Total time: 3.15 seconds
Throughput: 3.17 requests/second

🎉 PERFORMANCE IMPROVEMENT 🎉
Speedup: 3.3x faster!
Multi-threaded server is significantly faster for concurrent requests!
```

**Explanation:** With 4 threads, the server processes 4 requests **simultaneously**. 10 requests in 3 batches (4+4+2) = ~3 seconds total.

---

### 1.3 Visual Comparison

**Sequential (Single-threaded):**
```
Request 1 [=====1s=====]
Request 2                [=====1s=====]
Request 3                               [=====1s=====]
Request 4                                              [=====1s=====]
Request 5                                                             [=====1s=====]
Request 6                                                                            [=====1s=====]
Request 7                                                                                           [=====1s=====]
Request 8                                                                                                          [=====1s=====]
Request 9                                                                                                                         [=====1s=====]
Request 10                                                                                                                                       [=====1s=====]

Total: 10 seconds
```

**Parallel (Multi-threaded with 4 threads):**
```
Request 1 [=====1s=====]
Request 2 [=====1s=====]  } Batch 1
Request 3 [=====1s=====]
Request 4 [=====1s=====]

Request 5                [=====1s=====]
Request 6                [=====1s=====]  } Batch 2
Request 7                [=====1s=====]
Request 8                [=====1s=====]

Request 9                               [=====1s=====]
Request 10                              [=====1s=====]  } Batch 3

Total: ~3 seconds
```

**Result:** ~3.3x speedup! 🚀

---

## Part 2: Hit Counter and Race Condition

**Objective:** Demonstrate that concurrent access to shared data without synchronization causes race conditions, and show how locks fix it.

### 2.1 Trigger Race Condition (Without Locks)

**Commands:**
```bash
# Terminal 1: Start server WITHOUT thread-safety
python3 file_server_lab2.py content/ --no-locks --threads 50

# Terminal 2: Run race condition test
python3 test_race.py
```

> ⚠️ **Important:** `--no-locks` disables thread safety, `--threads 50` increases concurrency to expose the race condition.

**📸 SCREENSHOT 2.1 - Race Condition Detected**

![Screenshot 2.1](source/2.1_race_detected.png)

Capture the test output showing:
- Server configuration: "WITHOUT locks: --no-locks --threads 50"
- Expected counter value: **100**
- Actual counter value: **< 100** (e.g., 82)
- Lost increments: **> 0** (e.g., 18)
- Percentage lost: **> 0%** (e.g., 18.0%)
- Message: **"❌ RACE CONDITION DETECTED!"**

**Expected output:**
```
🧪 SIMPLE RACE CONDITION TEST

Checking server availability at localhost:8080...
✅ Server is running

📊 RESULTS:

WITHOUT locks: --no-locks --threads 50
Expected counter value: 100
Actual counter value:   82
Lost increments:        18 (18.0%)

❌ RACE CONDITION DETECTED!

Multiple threads overwrote each other's updates.
18 requests were processed but not counted correctly.
```

---

### 2.2 Show Problematic Code

**📸 SCREENSHOT 2.2 - Race Condition Code (Max 4 lines)**

![Screenshot 2.2](source/2.2_problematic_code.png)

Show the code in `file_server_lab2.py` around lines 280-290:

```python
# WITHOUT locks - RACE CONDITION! ❌
current_value = self.request_counter[path]
time.sleep(0.002)  # Simulates processing delay
self.request_counter[path] = current_value + 1  # Lost updates!
```

**What happens:**

```
Thread 1:                    Thread 2:
read counter = 10            
                             read counter = 10  ← Both read same value!
sleep(0.002s)
                             sleep(0.002s)
write counter = 11
                             write counter = 11 ← Overwrites! Lost 1 increment! ❌
```

**Result:** Expected = 12, Actual = 11 (lost 1 increment)

---

### 2.3 Show Fixed Version (With Locks)

**Commands:**
```bash
# Stop unsafe server (Ctrl+C in Terminal 1)

# Terminal 1: Start server WITH thread-safety (default)
python3 file_server_lab2.py content/ --threads 50

# Terminal 2: Run test again
python3 test_race.py
```

> ✅ **Note:** No `--no-locks` flag = locks are enabled by default.

**📸 SCREENSHOT 2.3 - Race Condition Fixed**

![Screenshot 2.3](source/2.3_race_fixed.png)

Capture the test output showing:
- Server configuration: "WITH locks (default): --threads 50"
- Expected counter value: **100**
- Actual counter value: **100**
- Lost increments: **0 (0.0%)**
- Message: **"✅ SUCCESS! All 100 requests counted correctly!"**

**Expected output:**
```
📊 RESULTS:

WITH locks (default): --threads 50
Expected counter value: 100
Actual counter value:   100
Lost increments:        0 (0.0%)

✅ SUCCESS! All 100 requests counted correctly!

The counter lock prevents race conditions.
All concurrent updates are synchronized properly.
```

---

### 2.4 Show Fixed Code

**📸 SCREENSHOT 2.4 - Thread-Safe Code (Max 4 lines)**

![Screenshot 2.4](source/2.4_fixed_code.png)

Show the code in `file_server_lab2.py` around lines 275-285:

```python
# WITH locks - THREAD SAFE! ✅
with self.counter_lock:  # Only one thread at a time!
    current_value = self.request_counter[path]
    time.sleep(0.002)
    self.request_counter[path] = current_value + 1  # Safe!
```

**What happens:**

```
Thread 1:                    Thread 2:
acquire lock ✅
read counter = 10
sleep(0.002s)
write counter = 11
release lock
                             acquire lock ✅ (was waiting)
                             read counter = 11  ← Correct value!
                             sleep(0.002s)
                             write counter = 12  ← Perfect! ✅
                             release lock
```

**Result:** Expected = 12, Actual = 12 (perfect!)

---

## Part 3: Rate Limiting

**Objective:** Demonstrate IP-based rate limiting by showing successful and denied requests per second.

### 3.1 Spam Test - Show Request Statistics

**Commands:**
```bash
# Terminal 1: Start server with rate limiting
python3 file_server_lab2.py content/ --rate-limit 5 --threads 8

# Terminal 2: Run rate limiting test
python3 benchmark_lab2.py rate-limit
```

**📸 SCREENSHOT 3.1 - Rate Limiting Statistics**

![Screenshot 3.1](source/3.1_statistics.png)

Capture the complete test output showing:
- **Configuration:** 5 requests/second limit per IP
- **Test parameters:** 10 req/s target, 5 seconds duration
- **Total requests sent:** 50
- **Successful (200 OK):** ~25
- **Denied (429):** ~25
- **Actual request rate:** ~9.96 req/s
- **Successful rate:** ~4.98 req/s ← Limited to ~5 req/s!
- **Denied rate:** ~4.98 req/s

**Expected output:**
```
🔥 RATE LIMITING TEST

⚙️  Configuration:
Server rate limit: 5 requests/second per IP
Test target rate: 10 requests/second
Duration: 5 seconds

Sending rapid requests...
Sent 50 requests in 5.02 seconds

📊 RATE LIMITING RESULTS:

Total requests sent: 50
  ✅ Successful (200 OK): 25
  ⛔ Denied (429 Too Many Requests): 25

Actual request rate: 9.96 requests/second
Successful rate: 4.98 requests/second  ← Limited to ~5 req/s ✅
Denied rate: 4.98 requests/second

✅ Rate limiting is working correctly!
The server limited throughput to ~5 req/s as configured.
```

**Explanation:** 
- Test sends 10 req/s to the server
- Server only allows 5 req/s per IP
- **Result:** ~50% of requests are denied (HTTP 429)
- Successful rate is capped at ~5 req/s ✅

---

### 3.2 Show IP Awareness

**Objective:** Demonstrate that rate limiting is **per-IP**, not global.

**Method 1: Server Logs**

While the rate limit test is running, observe the server logs in Terminal 1.

**📸 SCREENSHOT 3.2 - IP-Based Rate Limiting**

![Screenshot 3.2](source/3.2_ip_tracking.png)

Capture server logs showing:
- IP address being tracked (e.g., 127.0.0.1)
- Accepted requests with rate count: `[✅ 200] GET / (IP: 127.0.0.1, Rate: 4/5)`
- Denied requests with exceeded rate: `[⛔ 429] Rate limit exceeded for 127.0.0.1 (6/5 requests/second)`
- Request counter showing how many requests from that IP in the last second

**Example log output:**
```
[✅ 200] GET /index.html - 127.0.0.1 (Request 23/5 in window)
[✅ 200] GET /index.html - 127.0.0.1 (Request 24/5 in window)
[⛔ 429] Rate limit exceeded for 127.0.0.1 (6/5 requests/second)
[⛔ 429] Rate limit exceeded for 127.0.0.1 (7/5 requests/second)
[✅ 200] GET /index.html - 127.0.0.1 (Request 27/5 in window)
```

**Method 2: Multiple IPs (Optional)**

To demonstrate different IPs have separate rate limits:

```bash
# Terminal 2: Spam from localhost (will be rate limited)
while true; do curl -w " %{http_code}\n" http://localhost:8080/ -o /dev/null -s; sleep 0.05; done

# Terminal 3: Make requests from browser
# Open http://localhost:8080/ in browser
# Requests should succeed even while Terminal 2 is being rate limited
```

**📸 SCREENSHOT 3.3 (Optional) - Different IPs Have Separate Limits**

Show that while one IP (127.0.0.1) is being rate limited, another connection can still make requests successfully.

---

### 3.3 How Rate Limiting Works

**Algorithm: Sliding Window**

1. **Track per IP:** Each IP has its own request history
   ```python
   self.ip_requests = defaultdict(list)  # {IP: [timestamp1, timestamp2, ...]}
   ```

2. **Sliding window:** Only count requests from the last 1 second
   ```python
   recent = [ts for ts in timestamps if current_time - ts < 1.0]
   ```

3. **Check limit:** Reject if too many requests in window
   ```python
   if len(recent) >= self.rate_limit:  # e.g., 5
       return False  # HTTP 429 Too Many Requests
   ```

4. **Thread-safe:** Uses lock to prevent race conditions
   ```python
   with self.rate_limit_lock:
       # Check and update rate limit data safely
   ```

**Example Timeline:**

```
Time    Requests from IP 127.0.0.1    Status
0.0s    Request 1                     ✅ Allowed (1/5)
0.1s    Request 2                     ✅ Allowed (2/5)
0.2s    Request 3                     ✅ Allowed (3/5)
0.3s    Request 4                     ✅ Allowed (4/5)
0.4s    Request 5                     ✅ Allowed (5/5)
0.5s    Request 6                     ⛔ DENIED (6/5) ← Rate limit!
0.6s    Request 7                     ⛔ DENIED (7/5)
1.1s    Request 8                     ✅ Allowed (4/5) ← Old requests expired
```

---

## Screenshot Checklist

**Use this checklist to ensure you have all required screenshots for your lab report:**

### ✅ Part 1: Performance Comparison (2 screenshots)
- [ ] **Screenshot 1.1:** Single-threaded benchmark (~10 seconds for 10 requests)
- [ ] **Screenshot 1.2:** Multi-threaded benchmark (~3 seconds for 10 requests, showing 3.3x speedup)

### ✅ Part 2: Hit Counter and Race Condition (4 screenshots)
- [ ] **Screenshot 2.1:** Race condition test WITHOUT locks (showing lost increments)
- [ ] **Screenshot 2.2:** Problematic code (4 lines, without lock)
- [ ] **Screenshot 2.3:** Race condition test WITH locks (100% accuracy)
- [ ] **Screenshot 2.4:** Fixed code (4 lines, with lock)

### ✅ Part 3: Rate Limiting (2-3 screenshots)
- [ ] **Screenshot 3.1:** Rate limiting test statistics (50% denied at 10 req/s)
- [ ] **Screenshot 3.2:** Server logs showing IP-based tracking (127.0.0.1)
- [ ] **Screenshot 3.3 (Optional):** Different IPs with separate rate limits

**Total: 8-9 screenshots required**

---

## Conclusion

### Key Achievements

| Metric | Single-threaded | Multi-threaded | Improvement |
|--------|-----------------|----------------|-------------|
| **Time (10 requests)** | ~10 seconds | ~3 seconds | **3.3x faster** |
| **Throughput** | ~1 req/s | ~3.3 req/s | **230% increase** |
| **Concurrency** | Sequential | 4 parallel threads | **4x parallelism** |

| Feature | Without Locks | With Locks | Fix |
|---------|---------------|------------|-----|
| **Counter Accuracy** | 82/100 (82%) | 100/100 (100%) | **18% data loss prevented** |
| **Lost Updates** | 18 requests | 0 requests | **Thread-safe** |
| **Race Condition** | ❌ Present | ✅ Fixed | **Synchronized** |

| Metric | Without Limit | With Limit (5 req/s) | Protection |
|--------|---------------|----------------------|------------|
| **Request Rate** | Unlimited | 5 req/s per IP | **Protected** |
| **Denied (10 req/s spam)** | 0% | 50% | **Fair distribution** |
| **IP Tracking** | None | Per-IP windows | **DoS prevention** |

### Technical Skills Demonstrated

1. ✅ **Concurrent Programming:** Thread pools, worker threads, task queues
2. ✅ **Thread Synchronization:** Locks, race condition detection and prevention
3. ✅ **Socket Programming:** Custom HTTP server implementation
4. ✅ **Performance Analysis:** Benchmarking, throughput measurement, speedup calculation
5. ✅ **Rate Limiting:** Sliding window algorithm, per-IP tracking
6. ✅ **Testing:** Automated tests for race conditions and performance

### What I Learned

1. **Thread pools** improve performance for I/O-bound tasks by handling requests concurrently
2. **Race conditions** occur when threads access shared data without synchronization
3. **Locks** ensure thread safety but add overhead - use only where needed
4. **Rate limiting** protects servers from abuse while ensuring fairness
5. **Benchmarking** requires careful measurement to validate improvements

---

## Appendix: Complete Command Reference

### Server Commands

```bash
# Lab 1: Single-threaded server
python3 file_server.py content/

# Lab 2: Multi-threaded server (default configuration)
python3 file_server_lab2.py content/

# Performance testing configuration
python3 file_server_lab2.py content/ --delay 1 --threads 4

# Race condition demonstration (UNSAFE)
python3 file_server_lab2.py content/ --no-locks --threads 50

# Thread-safe version (SAFE)
python3 file_server_lab2.py content/ --threads 50

# Rate limiting configuration
python3 file_server_lab2.py content/ --rate-limit 5 --threads 8
```

### Test Commands

```bash
# Performance comparison (prompts for test 1 or 2)
python3 benchmark_lab2.py comparison

# Race condition test
python3 test_race_easy.py

# Rate limiting test
python3 benchmark_lab2.py rate-limit
```

### Quick Test Commands

```bash
# Check if server is running
curl http://localhost:8080/
```

---

**🎉 Lab completed successfully!**

**Completed by:** Nicolai Petcov  
**Date:** 21/10/2025