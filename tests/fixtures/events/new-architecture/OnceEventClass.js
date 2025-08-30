// Class-based event with once=true for new architecture testing
module.exports = class OnceEventClass {
  constructor() {
    this.name = 'onceEventClass'
    this.once = true
  }

  async execute(...args) {
    // Mock implementation for testing
    console.log('OnceEventClass executed once with:', args)
  }
}