// ✅ Clean and compatible with React Native 0.81+
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-reanimated/plugin', // ⚡ must always be last
  ],
};
