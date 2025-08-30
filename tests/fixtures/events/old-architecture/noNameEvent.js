// Invalid event missing name for testing error handling
module.exports = {
  // Missing name - should be rejected by EventLoader
  async execute(...args) {
    console.log('noNameEvent executed with:', args)
  }
}