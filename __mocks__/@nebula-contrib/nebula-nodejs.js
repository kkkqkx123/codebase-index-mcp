// Mock for @nebula-contrib/nebula-nodejs
module.exports = {
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    close: jest.fn(),
    execute: jest.fn(),
    ping: jest.fn()
  }))
};