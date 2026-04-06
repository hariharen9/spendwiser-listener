import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import App from './App';
import { headlessSmsHandler } from './src/services/background';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);

// Register the Headless JS task for background SMS parsing
AppRegistry.registerHeadlessTask('SpendWiserSmsTask', () => headlessSmsHandler);
