// Invalid class-based event missing execute method for testing error handling
module.exports = class InvalidEventClass {
  constructor() {
    this.name = 'invalidEventClass'
    // Missing execute method - should be rejected by EventLoader
  }
}