/**
 * @format
 */

import { AppRegistry } from 'react-native';
import './src/platform/runtime';
import App from './src/dashboard-components/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
