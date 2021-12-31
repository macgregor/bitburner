import * as lib from "lib.js";

function convert2DArrayToString(arr) {
    const components = [];
    arr.forEach((e) => {
        let s = e.toString();
        s = ["[", s, "]"].join("");
        components.push(s);
    });

    return components.join(",").replace(/\s/g, "");
}

function largestPrimeFactor(n){
  let fac = 2;
  while (n > fac) {
      if (n % fac === 0) {
          n = Math.round(n / fac);
          fac = 2;
      } else {
          ++fac;
      }
  }
  return fac;
}

function subarrayWithMaximumSum(data){
  const nums = data.slice();
  for (let i = 1; i < nums.length; i++) {
      nums[i] = Math.max(nums[i], nums[i] + nums[i - 1]);
  }
  return Math.max(...nums);
}

function totalWaysToSum(data){
    const ways = [1];
    ways.length = data + 1;
    ways.fill(0, 1);
    for (let i = 1; i < data; ++i) {
        for (let j = i; j <= data; ++j) {
            ways[j] += ways[j - i];
        }
    }
    return ways[data];
}

function spiralizeMatrix(data){
    const spiral = [];
    const mm = data.length;
    const nn = data[0].length;
    let u = 0;
    let d = mm - 1;
    let l = 0;
    let r = nn - 1;
    let k = 0;
    while (true) {
        // Up
        for (let col = l; col <= r; col++) {
            spiral[k] = data[u][col];
            ++k;
        }
        if (++u > d) { break; }

        // Right
        for (let row = u; row <= d; row++) {
            spiral[k] = data[row][r];
            ++k;
        }
        if (--r < l) { break; }

        // Down
        for (let col = r; col >= l; col--) {
            spiral[k] = data[d][col];
            ++k;
        }
        if (--d < u) { break; }

        // Left
        for (let row = d; row >= u; row--) {
            spiral[k] = data[row][l];
            ++k;
        }
        if (++l > r) { break; }
    }
    return spiral;
}

function arrayJumpingGame(data){
    var answer;
    const len = data.length;
    let j = 0;
    for (let reach = 0; j < len && j <= reach; ++j) {
        reach = Math.max(j + data[j], reach);
    }
    const solution = (j === len);
    if (solution) {
        answer = 1;
    } else {
        answer = 0;
    }
    return answer
}

function mergeOverlappingIntervals(data){
    const intervals = data.slice();
    intervals.sort((a, b) => {
        return a[0] - b[0];
    });

    const reslt = [];
    let start = intervals[0][0];
    let end = intervals[0][1];
    for (const interval of intervals) {
        if (interval[0] <= end) {
            end = Math.max(end, interval[1]);
        } else {
            reslt.push([start, end]);
            start = interval[0];
            end = interval[1];
        }
    }
    reslt.push([start, end]);
    return convert2DArrayToString(reslt);
}

function generateIPAddresses(data){
    const rett = [];
    for (let a = 1; a <= 3; ++a) {
        for (let b = 1; b <= 3; ++b) {
            for (let c = 1; c <= 3; ++c) {
                for (let d = 1; d <= 3; ++d) {
                    if (a + b + c + d === data.length) {
                        const A = parseInt(data.substring(0, a), 10);
                        const B = parseInt(data.substring(a, a + b), 10);
                        const C = parseInt(data.substring(a + b, a + b + c), 10);
                        const D = parseInt(data.substring(a + b + c, a + b + c + d), 10);
                        if (A <= 255 && B <= 255 && C <= 255 && D <= 255) {
                            const ip = [A.toString(), ".",
                                B.toString(), ".",
                                C.toString(), ".",
                                D.toString()
                            ].join("");
                            if (ip.length === data.length + 3) {
                                rett.push(ip);
                            }
                        }
                    }
                }
            }
        }
    }
    return rett;
}

function algorithmicStockTraderI(data){
    let maxCur = 0;
    let maxSoFar = 0;
    for (let i = 1; i < data.length; ++i) {
        maxCur = Math.max(0, maxCur += data[i] - data[i - 1]);
        maxSoFar = Math.max(maxCur, maxSoFar);
    }
    return maxSoFar.toString();
}

function algorithmicStockTraderII(data){
    let profit = 0;
    for (let p = 1; p < data.length; ++p) {
        profit += Math.max(data[p] - data[p - 1], 0);
    }
    return profit.toString();
}

function algorithmicStockTraderIII(data){
    let hold1 = Number.MIN_SAFE_INTEGER;
    let hold2 = Number.MIN_SAFE_INTEGER;
    let release1 = 0;
    let release2 = 0;
    for (const price of data) {
        release2 = Math.max(release2, hold2 + price);
        hold2 = Math.max(hold2, release1 - price);
        release1 = Math.max(release1, hold1 + price);
        hold1 = Math.max(hold1, price * -1);
    }
    return release2.toString();
}

function algorithmicStockTraderIV(data){
    const kk = (data[0]);
    const prices = (data[1]);
    const lenn = prices.length;
    if (lenn < 2) { return (parseInt(ans) === 0); }
    if (kk > lenn / 2) {
        let res = 0;
        for (let i = 1; i < lenn; ++i) {
            res += Math.max(prices[i] - prices[i - 1], 0);
        }
        return res;
    }

    const hold = [];
    const rele = [];
    hold.length = kk + 1;
    rele.length = kk + 1;
    for (let i = 0; i <= kk; ++i) {
        hold[i] = Number.MIN_SAFE_INTEGER;
        rele[i] = 0;
    }

    let cur;
    for (let i = 0; i < lenn; ++i) {
        cur = prices[i];
        for (let j = kk; j > 0; --j) {
            rele[j] = Math.max(rele[j], hold[j] + cur);
            hold[j] = Math.max(hold[j], rele[j - 1] - cur);
        }
    }
    return rele[kk];
}

function minimumPathSumInATriangle(data){
    let nnn = data.length;
    let dp = data[nnn - 1].slice();
    for (let i = nnn - 2; i > -1; --i) {
        for (let j = 0; j < data[i].length; ++j) {
            dp[j] = Math.min(dp[j], dp[j + 1]) + data[i][j];
        }
    }
    return dp[0];
}

function uniquePathsInAGridI(data){
    let rows = data[0]; // Number of rows
    let cols = data[1]; // Number of columns
    let currentRow = [];
    currentRow.length = rows;

    for (let k = 0; k < rows; k++) {
        currentRow[k] = 1;
    }
    for (let row = 1; row < cols; row++) {
        for (let l = 1; l < rows; l++) {
            currentRow[l] += currentRow[l - 1];
        }
    }
    return currentRow[rows - 1];
}

function uniquePathsInAGridII(data){
    let obstacleGrid = [];
    obstacleGrid.length = data.length;
    for (let i = 0; i < obstacleGrid.length; ++i) {
        obstacleGrid[i] = data[i].slice();
    }

    for (let i = 0; i < obstacleGrid.length; i++) {
        for (let j = 0; j < obstacleGrid[0].length; j++) {
            if (obstacleGrid[i][j] == 1) {
                obstacleGrid[i][j] = 0;
            } else if (i == 0 && j == 0) {
                obstacleGrid[0][0] = 1;
            } else {
                obstacleGrid[i][j] = (i > 0 ? obstacleGrid[i - 1][j] : 0) + (j > 0 ? obstacleGrid[i][j - 1] : 0);
            }

        }
    }
    return (obstacleGrid[obstacleGrid.length - 1][obstacleGrid[0].length - 1]);
}

function sanitizeParenthesesInExpression(data){
    let left = 0;
    let right = 0;
    let res = [];

    for (let i = 0; i < data.length; ++i) {
        if (data[i] === '(') {
            ++left;
        } else if (data[i] === ')') {
            (left > 0) ? --left: ++right;
        }
    }

    function dfs(pair, index, left, right, s, solution, res) {
        if (s.length === index) {
            if (left === 0 && right === 0 && pair === 0) {
                for (var i = 0; i < res.length; i++) {
                    if (res[i] === solution) { return; }
                }
                res.push(solution);
            }
            return;
        }

        if (s[index] === '(') {
            if (left > 0) {
                dfs(pair, index + 1, left - 1, right, s, solution, res);
            }
            dfs(pair + 1, index + 1, left, right, s, solution + s[index], res);
        } else if (s[index] === ')') {
            if (right > 0) dfs(pair, index + 1, left, right - 1, s, solution, res);
            if (pair > 0) dfs(pair - 1, index + 1, left, right, s, solution + s[index], res);
        } else {
            dfs(pair, index + 1, left, right, s, solution + s[index], res);
        }
    }
    dfs(0, 0, left, right, data, "", res);
    return res;
}

function findAllValidMathExpressions(data){
    const num = data[0];
    const tar = data[1];

    function helper(res, path, num, targ, pos, evaluated, multed) {
        if (pos === num.length) {
            if (targ === evaluated) {
                res.push(path);
            }
            return;
        }

        for (let i = pos; i < num.length; ++i) {
            if (i != pos && num[pos] == '0') { break; }
            let cur = parseInt(num.substring(pos, i + 1));

            if (pos === 0) {
                helper(res, path + cur, num, targ, i + 1, cur, cur);
            } else {
                helper(res, path + "+" + cur, num, targ, i + 1, evaluated + cur, cur);
                helper(res, path + "-" + cur, num, targ, i + 1, evaluated - cur, -cur);
                helper(res, path + "*" + cur, num, targ, i + 1, evaluated - multed + multed * cur, multed * cur);
            }
        }
    }

    let result = [];
    helper(result, "", num, tar, 0, 0, 0);
    return result;
}

class CodingContractContext extends lib.ModuleContext {
  /** @param {NS} ns **/
  constructor(ns, args){
      super(ns, args)
  }

  serverInitializer(){
    return async (server, context) => {
      return {
        neighbors: context.ns.scan(server.hostname),
        files: context.ns.ls(server.hostname)
      }
    }
  }
}

class CompleteCodingContracts extends lib.Action {
  constructor(){
      super("Find and complete coding contracts")
      this.solutions = {
        "Find Largest Prime Factor": largestPrimeFactor,
        "Subarray with Maximum Sum": subarrayWithMaximumSum,
        "Total Ways to Sum": totalWaysToSum,
        "Spiralize Matrix": spiralizeMatrix,
        "Array Jumping Game": arrayJumpingGame,
        "Merge Overlapping Intervals": mergeOverlappingIntervals,
        "Generate IP Addresses": generateIPAddresses,
        "Algorithmic Stock Trader I": algorithmicStockTraderI,
        "Algorithmic Stock Trader II": algorithmicStockTraderII,
        "Algorithmic Stock Trader III": algorithmicStockTraderIII,
        "Algorithmic Stock Trader IV": algorithmicStockTraderIV,
        "Minimum Path Sum in a Triangle": minimumPathSumInATriangle,
        "Unique Paths in a Grid I": uniquePathsInAGridI,
        "Unique Paths in a Grid II": uniquePathsInAGridII,
        "Sanitize Parentheses in Expression": sanitizeParenthesesInExpression,
        "Find All Valid Math Expressions": findAllValidMathExpressions,
      }
  }

  async priority(context){
    return 0
  }

  async isActionable(context){
    const servers = context.network.serversWithCodingContracts()
      .flatMap(s => s.codingContracts().map(f => {
          return {server: s.hostname, file: f}
      }))
      //.filter(cc => context.ns.codingcontract.getNumTriesRemaining(cc.file, cc.server) > 0)
    return servers.length > 0
  }

  async performAction(context){
    const contracts = context.network.serversWithCodingContracts()
      .flatMap(s => s.codingContracts().map(f => {
        const contractType = context.ns.codingcontract.getContractType(f, s.hostname)
        const data = context.ns.codingcontract.getData(f, s.hostname)
        const answer = this.solutions.hasOwnProperty(contractType) ? this.solutions[contractType](data) : null
        return {
            hostname: s.hostname,
            file: f,
            triesRemaining: context.ns.codingcontract.getNumTriesRemaining(f, s.hostname),
            contractType: contractType,
            data: data,
            //description: context.ns.codingcontract.getDescription(f, s.hostname),
            answer: answer
        }
      }))
    const results = {success: true, details: []}
    for(const contract of contracts){
      if(contract.triesRemaining < 1){
        results.success = false
        contract.status = "FAILED"
        contract.details = "No more tries remaining for contract"
      } else if(contract.answer == null){
        results.success = false
        contract.status = "FAILED"
        contract.details = "No solution for contract"
      } else{
        const reward = context.ns.codingcontract.attempt(contract.answer, contract.file, contract.hostname, {returnReward: true})
        if(reward != ""){
          contract.status = "SUCCESS"
          contract.details = "Reward: " + reward
        } else{
          contract.triesRemaining -= 1
          results.success = false
          contract.status = "FAILED"
          contract.details = "Incorrect answer"
        }
      }
      if(contract.answer.constructor.name == "Array" && contract.answer.length > 10){
        var shortAnswer = contract.answer.slice(0, 10)
        shortAnswer.push("..." + contract.answer.length-10 + " more")
        contract.answer = shortAnswer
      }
      results.details.push(contract)
    }
    return results
  }
}


/** @param {NS} ns **/
export async function main(ns) {
  const args = {
    logLevel: "info",
  }
    const context = new CodingContractContext(ns, args)
  const bot = new lib.ModuleEngine(context)
  bot.setActions([
    new CompleteCodingContracts()
	])

	await bot.main()
}
