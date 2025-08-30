// Plain object event for old architecture testing
module.exports = {
  name: 'testEvent',
  async execute(...args) {
    // Mock implementation for testing
    console.log('testEvent executed with:', args)
  }
}