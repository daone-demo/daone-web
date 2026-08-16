/**
 * 纯 JS HMAC-SHA256（Node / 浏览器均可），避免前端打包 node:crypto。
 * 仅用于 media-proxy 短时签名，非通用密码学工具库。
 */

function rotr(n, x) {
  return (x >>> n) | (x << (32 - n))
}

function ch(x, y, z) {
  return (x & y) ^ (~x & z)
}

function maj(x, y, z) {
  return (x & y) ^ (x & z) ^ (y & z)
}

function sigma0(x) {
  return rotr(2, x) ^ rotr(13, x) ^ rotr(22, x)
}

function sigma1(x) {
  return rotr(6, x) ^ rotr(11, x) ^ rotr(25, x)
}

function gamma0(x) {
  return rotr(7, x) ^ rotr(18, x) ^ (x >>> 3)
}

function gamma1(x) {
  return rotr(17, x) ^ rotr(19, x) ^ (x >>> 10)
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function sha256(bytes) {
  const bitLen = bytes.length * 8
  const withPad = new Uint8Array(((bytes.length + 9 + 63) & ~63))
  withPad.set(bytes)
  withPad[bytes.length] = 0x80
  const view = new DataView(withPad.buffer)
  view.setUint32(withPad.length - 4, bitLen >>> 0, false)
  view.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000), false)

  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19
  const w = new Uint32Array(64)

  for (let i = 0; i < withPad.length; i += 64) {
    for (let j = 0; j < 16; j += 1) {
      w[j] = view.getUint32(i + j * 4, false)
    }
    for (let j = 16; j < 64; j += 1) {
      w[j] = (gamma1(w[j - 2]) + w[j - 7] + gamma0(w[j - 15]) + w[j - 16]) >>> 0
    }
    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7
    for (let j = 0; j < 64; j += 1) {
      const t1 = (h + sigma1(e) + ch(e, f, g) + K[j] + w[j]) >>> 0
      const t2 = (sigma0(a) + maj(a, b, c)) >>> 0
      h = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + h) >>> 0
  }

  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  outView.setUint32(0, h0, false)
  outView.setUint32(4, h1, false)
  outView.setUint32(8, h2, false)
  outView.setUint32(12, h3, false)
  outView.setUint32(16, h4, false)
  outView.setUint32(20, h5, false)
  outView.setUint32(24, h6, false)
  outView.setUint32(28, h7, false)
  return out
}

function toBytes(input) {
  if (typeof input === 'string') {
    return new TextEncoder().encode(input)
  }
  return input instanceof Uint8Array ? input : new Uint8Array(input)
}

function hexFromBytes(bytes) {
  let out = ''
  for (const value of bytes) {
    out += value.toString(16).padStart(2, '0')
  }
  return out
}

export function hmacSha256Hex(secret, message) {
  const blockSize = 64
  let key = toBytes(secret)
  if (key.length > blockSize) key = sha256(key)
  if (key.length < blockSize) {
    const padded = new Uint8Array(blockSize)
    padded.set(key)
    key = padded
  }
  const oKey = new Uint8Array(blockSize)
  const iKey = new Uint8Array(blockSize)
  for (let i = 0; i < blockSize; i += 1) {
    oKey[i] = key[i] ^ 0x5c
    iKey[i] = key[i] ^ 0x36
  }
  const inner = new Uint8Array(blockSize + toBytes(message).length)
  inner.set(iKey)
  inner.set(toBytes(message), blockSize)
  const outer = new Uint8Array(blockSize + 32)
  outer.set(oKey)
  outer.set(sha256(inner), blockSize)
  return hexFromBytes(sha256(outer))
}

export function safeEqualString(a, b) {
  const left = String(a)
  const right = String(b)
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return diff === 0
}
