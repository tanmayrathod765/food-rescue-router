\# Algorithm Documentation



\## 1. TSP (Travelling Salesman Problem)



\### Implementation

\- Nearest Neighbor Heuristic (O(n²))

\- 2-opt Improvement

\- Time Window Enforcement

\- Urgency Weighting



\### Files

\- src/algorithms/tsp/nearestNeighbor.js

\- src/algorithms/tsp/twoOpt.js

\- src/algorithms/tsp/timeWindows.js

\- src/algorithms/tsp/urgencyWeight.js



\## 2. Bipartite Matching



\### Implementation

\- Weighted Score Matrix

\- Greedy Matching (highest score first)

\- Cascade Fallback (5 levels)



\### Scoring Formula

SCORE = 0.35×proximity + 0.30×capacity + 0.20×time + 0.15×trust



\### Files

\- src/algorithms/matching/scoreCalculator.js

\- src/algorithms/matching/bipartiteMatch.js

\- src/algorithms/matching/cascadeMatch.js



\## 3. Concurrency Control



\### Implementation

\- PostgreSQL SELECT FOR UPDATE

\- Optimistic Locking (version field)

\- Atomic Transactions



\### Files

\- src/services/claim.service.js

