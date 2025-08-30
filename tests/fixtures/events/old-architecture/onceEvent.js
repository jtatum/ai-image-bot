// Plain object event with once=true for old architecture testing
module.exports = {
  name: 'onceEvent',
  once: true,
  async execute(...args) {
    // Mock implementation for testing
    console.log('onceEvent executed once with:', args)
  }
}