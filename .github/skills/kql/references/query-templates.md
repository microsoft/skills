# KQL Query Templates

Reusable query patterns for common data investigation operations. Copy and adapt these.

## Table of Contents

1. [Deduplication](#1-deduplication)
2. [Top-N Analysis](#2-top-n-analysis)
3. [Time Binning & Trends](#3-time-binning--trends)
4. [Pivoting](#4-pivoting)
5. [Running Totals & Window Functions](#5-running-totals--window-functions)
6. [Sessionization](#6-sessionization)
7. [Cardinality Check Before Join](#7-cardinality-check-before-join)
8. [Safe Exploration Pattern](#8-safe-exploration-pattern)
9. [Diffing & Anomaly Detection](#9-diffing--anomaly-detection)
10. [String Extraction Patterns](#10-string-extraction-patterns)

---

## 1. Deduplication

### Exact deduplication
```kql
// Remove exact duplicate rows
Table
| distinct *
```

### Dedup keeping latest per key
```kql
// Keep the most recent record per entity
Table
| summarize arg_max(Timestamp, *) by EntityId
```

### Dedup keeping first per key
```kql
// Keep the earliest record per entity
Table
| summarize arg_min(Timestamp, *) by EntityId
```

### Count duplicates
```kql
// Find records that appear more than once
Table
| summarize cnt = count() by Col1, Col2, Col3
| where cnt > 1
| order by cnt desc
```

---

## 2. Top-N Analysis

### Top N by count
```kql
Table
| summarize EventCount = count() by Category
| top 10 by EventCount desc
```

### Top N by metric, with ties
```kql
Table
| summarize TotalRevenue = sum(Amount) by Customer
| order by TotalRevenue desc
| take 10
```

### Top N per group
```kql
// Top 3 events per category
Table
| summarize EventCount = count() by Category, EventType
| partition by Category (top 3 by EventCount desc)
```

### Bottom N (least common)
```kql
Table
| summarize cnt = count() by Category
| top 10 by cnt asc
```

---

## 3. Time Binning & Trends

### Hourly event counts
```kql
Events
| summarize count() by bin(Timestamp, 1h)
| order by Timestamp asc
```

### Day-over-day comparison
```kql
Events
| where Timestamp > ago(14d)
| summarize count() by Day = bin(Timestamp, 1d)
| order by Day asc
| extend PrevDayCount = prev(count_)
| extend DayOverDayChange = count_ - PrevDayCount
| serialize  // needed for prev()
```

### Activity by hour of day
```kql
Events
| extend HourOfDay = datetime_part("hour", Timestamp)
| summarize count() by HourOfDay
| order by HourOfDay asc
```

### Activity by day of week
```kql
Events
| extend DayOfWeek = dayofweek(Timestamp) / 1d
| summarize count() by DayOfWeek
| order by DayOfWeek asc
```

---

## 4. Pivoting

### Counts by category (pivot)
```kql
Events
| evaluate pivot(Category, count(), bin(Timestamp, 1d))
```

### Manual pivot with summarize
```kql
Events
| summarize
    TypeA = countif(Type == "A"),
    TypeB = countif(Type == "B"),
    TypeC = countif(Type == "C")
    by bin(Timestamp, 1h)
```

---

## 5. Running Totals & Window Functions

### Running total
```kql
Table
| order by Timestamp asc
| extend RunningTotal = row_cumsum(Value)
```

### Row numbers
```kql
Table
| order by Score desc
| extend Rank = row_number()
```

### Previous/next row comparison
```kql
Table
| order by Timestamp asc
| extend PrevValue = prev(Value), NextValue = next(Value)
| extend Delta = Value - PrevValue
```

**Remember**: All these require serialized input — use `| order by` or `| serialize` before calling.

---

## 6. Sessionization

### Gap-based sessions
```kql
// Group events into sessions (30-min idle gap)
Events
| order by UserId, Timestamp asc
| extend SessionStart = row_window_session(Timestamp, 24h, 30m, UserId != prev(UserId))
| summarize
    SessionEnd = max(Timestamp),
    EventCount = count()
    by UserId, SessionStart
```

### Sequential numbering within groups
```kql
Events
| order by UserId, Timestamp asc
| extend SeqNum = row_number(1, UserId != prev(UserId))
```

---

## 7. Cardinality Check Before Join

**Always run this before joining large tables:**

```kql
// Step 1: Check left side cardinality
TableA | summarize LeftRows = count(), LeftDistinctKeys = dcount(JoinKey)

// Step 2: Check right side cardinality
TableB | summarize RightRows = count(), RightDistinctKeys = dcount(JoinKey)

// Step 3: Estimate output size
// If LeftDistinctKeys × RightDistinctKeys > 1M, add filters before joining

// Step 4: Safe join with pre-filtering
TableA
| where Timestamp > ago(1d)  // narrow the time window
| join kind=inner (
    TableB | where IsActive == true  // narrow the right side too
) on JoinKey
```

### Join kind selection guide

| Kind | Behavior | Use when |
|------|----------|----------|
| `inner` | Only matching rows from both | Default choice |
| `leftouter` | All left rows + matches from right | Need all left rows even without match |
| `leftanti` | Left rows with NO match in right | Finding missing/orphan records |
| `leftsemi` | Left rows that HAVE a match in right | Existence check (like SQL `EXISTS`) |
| `fullouter` | All rows from both sides | Comparing two datasets |

---

## 8. Safe Exploration Pattern

When encountering a new table, always follow this progression:

```kql
// Step 1: How big is it?
Table | count

// Step 2: What does it look like?
Table | take 5

// Step 3: What's the time range?
Table | summarize min(Timestamp), max(Timestamp)

// Step 4: What are the key dimensions?
Table | summarize dcount(Col1), dcount(Col2), dcount(Col3)

// Step 5: What's the value distribution?
Table
| summarize count() by Col1
| top 10 by count_ desc
```

**Never skip to a complex query without running Steps 1-2 first.** Knowing the table size prevents memory errors; seeing sample rows prevents wrong assumptions about column values.

---

## 9. Diffing & Anomaly Detection

### Find outliers by standard deviation
```kql
Table
| summarize avg_val = avg(Value), stdev_val = stdev(Value)
| join kind=inner Table on true()
| where Value > avg_val + 3 * stdev_val or Value < avg_val - 3 * stdev_val
```

### Compare two time periods
```kql
let period1 = Table | where Timestamp between (datetime(2023-01-01) .. datetime(2023-01-31));
let period2 = Table | where Timestamp between (datetime(2023-02-01) .. datetime(2023-02-28));
period1 | summarize P1_Count = count() by Category
| join kind=fullouter (period2 | summarize P2_Count = count() by Category) on Category
| extend Change = P2_Count - P1_Count, ChangePercent = round(100.0 * (P2_Count - P1_Count) / P1_Count, 1)
```

### Find records that appear in one table but not another
```kql
// Records in A but not in B
TableA | join kind=leftanti TableB on Key
```

### Find new entities (appeared after a cutoff)
```kql
let cutoff = datetime(2023-06-01);
Table
| summarize FirstSeen = min(Timestamp) by EntityId
| where FirstSeen > cutoff
```

---

## 10. String Extraction Patterns

### Extract structured fields
```kql
// Parse key=value pairs
Logs | parse Message with * "user=" User " " * "action=" Action " " *

// Extract with regex
Logs | extend IP = extract(@"(\d+\.\d+\.\d+\.\d+)", 1, Message)

// Extract all matches (remember: needs capturing groups!)
Logs | extend AllIPs = extract_all(@"(\d+\.\d+\.\d+\.\d+)", Message)
```

### Split and expand
```kql
// Split a delimited string and expand into rows
Table
| extend Parts = split(DelimitedField, ",")
| mv-expand Part = Parts to typeof(string)
```

### URL parsing
```kql
Logs
| extend Host = parse_url(Url).Host
| extend Path = parse_url(Url).Path
| extend QueryParams = parse_url(Url).["Query Parameters"]
```

### JSON field extraction
```kql
// Direct property access
Logs | extend UserId = tostring(Properties.userId)

// Nested JSON
Logs | extend City = tostring(Properties.address.city)

// Parse JSON string
Logs | extend Parsed = parse_json(JsonString) | extend Name = tostring(Parsed.name)
```
