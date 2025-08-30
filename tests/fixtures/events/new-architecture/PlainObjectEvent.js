// Plain object exported in new architecture directory (should work)
module.exports = {
  name: 'plainObjectInNewArch',
  async execute(...args) {
    console.log('plainObjectInNewArch executed with:', args)
  }
}