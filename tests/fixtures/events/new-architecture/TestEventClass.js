// Class-based event for new architecture testing
module.exports = class TestEventClass {
  constructor() {
    this.name = 'testEventClass'
  }

  async execute(...args) {
    // Mock implementation for testing
    console.log('TestEventClass executed with:', args)
  }
}