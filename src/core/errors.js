class LErr extends Error {
  constructor(code, params = {}, message) {
    super(message || code)
    this.code = code
    this.params = params
  }
}

module.exports = { LErr }
