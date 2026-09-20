import vm from 'node:vm';
import { ToolDefinition, ToolExecutionResult } from '../types/index.js';

export const mathToolDefinition: ToolDefinition = {
  name: 'math_eval',
  description: 'Evaluate complex mathematical, algebraic, statistical, number-theoretic, or calculus calculations with absolute precision using an isolated sandboxed engine. Supports BigInt, fast Fibonacci, polynomials (polyRoots, polyEval, polyDeriv), number theory (gcd, lcm, isPrime, modPow, primeFactors, eulerTotient, isCoprime), distributions (normalCDF, normalPDF, binomialProb, poissonProb), linear algebra (matrixMult, matrixTranspose, matrixInverse2x2, det2x2, det3x3, eigen2x2, dot, cross), numerical calculus (numericalDerivative, simpsonIntegral), base conversion (toBase, fromBase), and 2D ASCII curve plotting (asciiPlot).',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The mathematical expression or JavaScript snippet to evaluate. E.g. "factorial(50)", "fibonacci(100)", "modPow(7n, 100n, 13n)", "eulerTotient(36)", "polyRoots(1, -5, 6)", "asciiPlot(Math.sin, 0, 2*Math.PI)", "normalCDF(1.96)".',
      },
    },
    required: ['expression'],
  },
};

// --- Math Helper Library for the Sandbox ---

function factorial(n: number | bigint): bigint {
  let bi = typeof n === 'bigint' ? n : BigInt(Math.floor(Number(n)));
  if (bi < 0n) throw new Error('Factorial is not defined for negative numbers');
  if (bi === 0n || bi === 1n) return 1n;
  let result = 1n;
  for (let i = 2n; i <= bi; i++) {
    result *= i;
  }
  return result;
}

function nCr(n: number | bigint, r: number | bigint): bigint {
  const bn = typeof n === 'bigint' ? n : BigInt(Math.floor(Number(n)));
  const br = typeof r === 'bigint' ? r : BigInt(Math.floor(Number(r)));
  if (br < 0n || br > bn) return 0n;
  if (br === 0n || br === bn) return 1n;
  const k = br < bn - br ? br : bn - br;
  let num = 1n;
  let den = 1n;
  for (let i = 1n; i <= k; i++) {
    num *= bn - (i - 1n);
    den *= i;
  }
  return num / den;
}

function nPr(n: number | bigint, r: number | bigint): bigint {
  const bn = typeof n === 'bigint' ? n : BigInt(Math.floor(Number(n)));
  const br = typeof r === 'bigint' ? r : BigInt(Math.floor(Number(r)));
  if (br < 0n || br > bn) return 0n;
  let result = 1n;
  for (let i = 0n; i < br; i++) {
    result *= bn - i;
  }
  return result;
}

function gcd(a: number | bigint, b: number | bigint): bigint {
  let ba = (typeof a === 'bigint' ? a : BigInt(Math.floor(Number(a))));
  let bb = (typeof b === 'bigint' ? b : BigInt(Math.floor(Number(b))));
  ba = ba < 0n ? -ba : ba;
  bb = bb < 0n ? -bb : bb;
  while (bb !== 0n) {
    const t = bb;
    bb = ba % bb;
    ba = t;
  }
  return ba;
}

function lcm(a: number | bigint, b: number | bigint): bigint {
  const ba = typeof a === 'bigint' ? a : BigInt(Math.floor(Number(a)));
  const bb = typeof b === 'bigint' ? b : BigInt(Math.floor(Number(b)));
  if (ba === 0n || bb === 0n) return 0n;
  const g = gcd(ba, bb);
  const prod = ba * bb;
  const pos = prod < 0n ? -prod : prod;
  return pos / g;
}

function modPow(base: number | bigint, exp: number | bigint, mod: number | bigint): bigint {
  let b = (typeof base === 'bigint' ? base : BigInt(Math.floor(Number(base))));
  let e = (typeof exp === 'bigint' ? exp : BigInt(Math.floor(Number(exp))));
  const m = (typeof mod === 'bigint' ? mod : BigInt(Math.floor(Number(mod))));
  if (m === 1n) return 0n;
  let res = 1n;
  b = b % m;
  if (b < 0n) b += m;
  while (e > 0n) {
    if (e % 2n === 1n) res = (res * b) % m;
    e = e / 2n;
    b = (b * b) % m;
  }
  return res;
}

function modInverse(a: number | bigint, m: number | bigint): bigint {
  let ba = typeof a === 'bigint' ? a : BigInt(Math.floor(Number(a)));
  let bm = typeof m === 'bigint' ? m : BigInt(Math.floor(Number(m)));
  ba = (ba % bm + bm) % bm;
  let [m0, y, x] = [bm, 0n, 1n];
  if (bm === 1n) return 0n;
  while (ba > 1n) {
    if (bm === 0n) throw new Error('Modular inverse does not exist (not coprime)');
    const q = ba / bm;
    let t = bm;
    bm = ba % bm;
    ba = t;
    t = y;
    y = x - q * y;
    x = t;
  }
  if (x < 0n) x += m0;
  return x;
}

function isPrime(n: number | bigint): boolean {
  const bn = typeof n === 'bigint' ? n : BigInt(Math.floor(Number(n)));
  if (bn <= 1n) return false;
  if (bn <= 3n) return true;
  if (bn % 2n === 0n || bn % 3n === 0n) return false;
  let i = 5n;
  while (i * i <= bn) {
    if (bn % i === 0n || bn % (i + 2n) === 0n) return false;
    i += 6n;
  }
  return true;
}

function primeFactors(n: number | bigint): { prime: bigint; count: number }[] {
  let bn = typeof n === 'bigint' ? n : BigInt(Math.floor(Number(n)));
  if (bn <= 1n) return [];
  const factors: { prime: bigint; count: number }[] = [];

  let count2 = 0;
  while (bn % 2n === 0n) {
    count2++;
    bn /= 2n;
  }
  if (count2 > 0) factors.push({ prime: 2n, count: count2 });

  let d = 3n;
  while (d * d <= bn) {
    let count = 0;
    while (bn % d === 0n) {
      count++;
      bn /= d;
    }
    if (count > 0) factors.push({ prime: d, count });
    d += 2n;
  }
  if (bn > 1n) {
    factors.push({ prime: bn, count: 1 });
  }
  return factors;
}

function sum(arr: number[]): number {
  return arr.reduce((acc, v) => acc + v, 0);
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return sum(arr) / arr.length;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function variance(arr: number[], sample: boolean = false): number {
  if (arr.length <= (sample ? 1 : 0)) return 0;
  const m = mean(arr);
  const squaredDiffs = arr.map((x) => (x - m) ** 2);
  const divisor = sample ? arr.length - 1 : arr.length;
  return sum(squaredDiffs) / divisor;
}

function std(arr: number[], sample: boolean = false): number {
  return Math.sqrt(variance(arr, sample));
}

function dot(u: number[], v: number[]): number {
  if (u.length !== v.length) throw new Error('Vectors must have same length');
  return u.reduce((acc, val, i) => acc + val * v[i], 0);
}

function norm(v: number[]): number {
  return Math.sqrt(v.reduce((acc, val) => acc + val * val, 0));
}

function cross(u: number[], v: number[]): [number, number, number] {
  if (u.length !== 3 || v.length !== 3) throw new Error('Cross product is defined for 3D vectors');
  return [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
}

function matrixMult(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length;
  const colsA = A[0].length;
  const rowsB = B.length;
  const colsB = B[0].length;
  if (colsA !== rowsB) throw new Error(`Cannot multiply matrices of dimension ${rowsA}x${colsA} and ${rowsB}x${colsB}`);
  const result: number[][] = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

function det2x2(M: number[][]): number {
  return M[0][0] * M[1][1] - M[0][1] * M[1][0];
}

function det3x3(M: number[][]): number {
  return (
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
  );
}

function matrixTranspose(M: number[][]): number[][] {
  if (M.length === 0) return [];
  const rows = M.length;
  const cols = M[0].length;
  const T: number[][] = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      T[j][i] = M[i][j];
    }
  }
  return T;
}

function matrixInverse2x2(M: number[][]): number[][] {
  const d = det2x2(M);
  if (Math.abs(d) < 1e-12) throw new Error('Matrix is singular (determinant is zero)');
  return [
    [M[1][1] / d, -M[0][1] / d],
    [-M[1][0] / d, M[0][0] / d],
  ];
}

function eigen2x2(M: number[][]): { values: (number | string)[]; trace: number; det: number } {
  const tr = M[0][0] + M[1][1];
  const d = det2x2(M);
  const roots = polyRoots(1, -tr, d);
  return { values: roots.roots, trace: tr, det: d };
}

function numericalDerivative(f: (x: number) => number, x: number, h: number = 1e-7): number {
  return (f(x + h) - f(x - h)) / (2 * h);
}

function simpsonIntegral(f: (x: number) => number, a: number, b: number, n: number = 1000): number {
  if (n % 2 !== 0) n++;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    s += (i % 2 === 0 ? 2 : 4) * f(x);
  }
  return (s * h) / 3;
}

function fibonacci(n: number | bigint): bigint {
  const bn = typeof n === 'bigint' ? n : BigInt(Math.floor(Number(n)));
  if (bn < 0n) throw new Error('Fibonacci not defined for negative numbers');
  if (bn === 0n) return 0n;
  if (bn === 1n) return 1n;

  function fastDoubling(k: bigint): [bigint, bigint] {
    if (k === 0n) return [0n, 1n];
    const [a, b] = fastDoubling(k / 2n);
    const c = a * (2n * b - a);
    const d = a * a + b * b;
    if (k % 2n === 0n) {
      return [c, d];
    } else {
      return [d, c + d];
    }
  }
  return fastDoubling(bn)[0];
}

function polyRoots(a: number, b: number, c: number): { real: boolean; roots: (number | string)[] } {
  if (a === 0) {
    if (b === 0) return { real: true, roots: [] };
    return { real: true, roots: [-c / b] };
  }
  const disc = b * b - 4 * a * c;
  if (disc >= 0) {
    const sqrtD = Math.sqrt(disc);
    const r1 = (-b + sqrtD) / (2 * a);
    const r2 = (-b - sqrtD) / (2 * a);
    return { real: true, roots: r1 === r2 ? [r1] : [r1, r2] };
  } else {
    const realPart = -b / (2 * a);
    const imagPart = Math.sqrt(-disc) / (2 * Math.abs(a));
    const r1 = `${realPart.toFixed(6)} + ${imagPart.toFixed(6)}i`;
    const r2 = `${realPart.toFixed(6)} - ${imagPart.toFixed(6)}i`;
    return { real: false, roots: [r1, r2] };
  }
}

function polyEval(coeffs: number[], x: number): number {
  let val = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    val = val * x + coeffs[i];
  }
  return val;
}

function polyDeriv(coeffs: number[]): number[] {
  if (coeffs.length <= 1) return [0];
  const deriv: number[] = [];
  for (let i = 1; i < coeffs.length; i++) {
    deriv.push(coeffs[i] * i);
  }
  return deriv;
}

function eulerTotient(n: number | bigint): bigint {
  const bn = typeof n === 'bigint' ? n : BigInt(Math.floor(Number(n)));
  if (bn <= 0n) return 0n;
  let result = bn;
  const factors = primeFactors(bn);
  for (const f of factors) {
    result -= result / f.prime;
  }
  return result;
}

function isCoprime(a: number | bigint, b: number | bigint): boolean {
  return gcd(a, b) === 1n;
}

function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

function normalCDF(x: number, mean: number = 0, std: number = 1): number {
  if (std <= 0) throw new Error('Standard deviation must be positive');
  return 0.5 * (1 + erf((x - mean) / (std * Math.SQRT2)));
}

function normalPDF(x: number, mean: number = 0, std: number = 1): number {
  if (std <= 0) throw new Error('Standard deviation must be positive');
  const z = (x - mean) / std;
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

function binomialProb(n: number, k: number, p: number): number {
  if (p < 0 || p > 1) throw new Error('Probability p must be between 0 and 1');
  if (k < 0 || k > n) return 0;
  const coeff = Number(nCr(n, k));
  return coeff * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

function poissonProb(k: number, lambda: number): number {
  if (lambda <= 0) throw new Error('Lambda must be positive');
  if (k < 0) return 0;
  let term = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) {
    term *= lambda / i;
  }
  return term;
}

function toBase(n: number | bigint, radix: number = 16): string {
  const bi = typeof n === 'bigint' ? n : BigInt(Math.floor(Number(n)));
  const prefix = radix === 2 ? '0b' : radix === 8 ? '0o' : radix === 16 ? '0x' : '';
  return `${prefix}${bi.toString(radix)}`;
}

function fromBase(str: string, radix: number = 10): bigint {
  const clean = str.trim().toLowerCase();
  if (clean.startsWith('0b')) return BigInt(clean);
  if (clean.startsWith('0x')) return BigInt(clean);
  if (clean.startsWith('0o')) return BigInt(clean);
  if (radix === 10) return BigInt(clean);
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let res = 0n;
  const base = BigInt(radix);
  for (const c of clean) {
    const val = digits.indexOf(c);
    if (val < 0 || val >= radix) throw new Error(`Invalid digit '${c}' for radix ${radix}`);
    res = res * base + BigInt(val);
  }
  return res;
}

function asciiPlot(
  f: (x: number) => number,
  minX: number,
  maxX: number,
  width: number = 50,
  height: number = 14
): string {
  if (minX >= maxX) throw new Error('minX must be less than maxX');
  const dx = (maxX - minX) / (width - 1);
  const xs: number[] = [];
  const ys: number[] = [];

  for (let i = 0; i < width; i++) {
    const x = minX + i * dx;
    xs.push(x);
    const y = f(x);
    ys.push(Number.isFinite(y) ? y : NaN);
  }

  const validYs = ys.filter((y) => !Number.isNaN(y));
  if (validYs.length === 0) return 'No finite values to plot.';

  let minY = Math.min(...validYs);
  let maxY = Math.max(...validYs);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(' '));

  const zeroRow = 0 >= minY && 0 <= maxY ? Math.round(((maxY - 0) / (maxY - minY)) * (height - 1)) : -1;
  if (zeroRow >= 0 && zeroRow < height) {
    for (let c = 0; c < width; c++) grid[zeroRow][c] = '─';
  }

  const zeroCol = 0 >= minX && 0 <= maxX ? Math.round(((0 - minX) / (maxX - minX)) * (width - 1)) : -1;
  if (zeroCol >= 0 && zeroCol < width) {
    for (let r = 0; r < height; r++) {
      grid[r][zeroCol] = grid[r][zeroCol] === '─' ? '┼' : '│';
    }
  }

  for (let c = 0; c < width; c++) {
    const y = ys[c];
    if (Number.isNaN(y)) continue;
    const r = Math.round(((maxY - y) / (maxY - minY)) * (height - 1));
    if (r >= 0 && r < height) {
      grid[r][c] = '●';
    }
  }

  const lines = grid.map((row, r) => {
    let label = '       ';
    if (r === 0) label = `${maxY.toFixed(2).padStart(7, ' ')} `;
    else if (r === height - 1) label = `${minY.toFixed(2).padStart(7, ' ')} `;
    else if (r === zeroRow) label = `${'0.00'.padStart(7, ' ')} `;
    return `${label}│${row.join('')}`;
  });

  const xLabelMin = minX.toFixed(2);
  const xLabelMax = maxX.toFixed(2);
  const padding = ' '.repeat(Math.max(1, width - xLabelMin.length - xLabelMax.length));
  lines.push(`        └${'─'.repeat(width)}`);
  lines.push(`         ${xLabelMin}${padding}${xLabelMax}`);

  return lines.join('\n');
}

export async function executeMathEval(args: { expression?: string; expr?: string }): Promise<ToolExecutionResult> {
  const expr = args.expression || args.expr;
  if (!expr || !expr.trim()) {
    return {
      tool_call_id: '',
      name: 'math_eval',
      output: 'Error: No mathematical expression provided to evaluate.',
      isError: true,
      actionType: 'info',
    };
  }

  try {
    const sandbox: Record<string, any> = {
      Math,
      BigInt,
      factorial,
      fibonacci,
      nCr,
      nPr,
      gcd,
      lcm,
      modPow,
      modInverse,
      isPrime,
      primeFactors,
      eulerTotient,
      isCoprime,
      polyRoots,
      polyEval,
      polyDeriv,
      erf,
      normalCDF,
      normalPDF,
      binomialProb,
      poissonProb,
      toBase,
      fromBase,
      asciiPlot,
      sum,
      mean,
      median,
      variance,
      std,
      dot,
      cross,
      norm,
      matrixMult,
      matrixTranspose,
      matrixInverse2x2,
      det2x2,
      det3x3,
      eigen2x2,
      numericalDerivative,
      simpsonIntegral,
      result: undefined,
    };

    const context = vm.createContext(sandbox);
    
    // Execute expression
    const code = `
      try {
        result = (${expr.trim()});
      } catch (err) {
        result = { __error: err.message };
      }
    `;

    const script = new vm.Script(code);
    script.runInContext(context, { timeout: 3000 });

    const res = sandbox.result;
    if (res && typeof res === 'object' && res.__error) {
      return {
        tool_call_id: '',
        name: 'math_eval',
        output: `Math Error: ${res.__error}`,
        isError: true,
        actionType: 'info',
      };
    }

    let formattedOutput: string;
    if (typeof res === 'bigint') {
      formattedOutput = `${res.toString()}n (${res.toString()})`;
    } else if (typeof res === 'number') {
      formattedOutput = Number.isInteger(res)
        ? res.toString()
        : `${res} (approx: ${res.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')})`;
    } else if (Array.isArray(res) || (res !== null && typeof res === 'object')) {
      formattedOutput = JSON.stringify(res, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
    } else {
      formattedOutput = String(res);
    }

    return {
      tool_call_id: '',
      name: 'math_eval',
      output: formattedOutput,
      isError: false,
      actionType: 'info',
    };
  } catch (error: any) {
    return {
      tool_call_id: '',
      name: 'math_eval',
      output: `Math Execution Error: ${error.message || String(error)}`,
      isError: true,
      actionType: 'info',
    };
  }
}
