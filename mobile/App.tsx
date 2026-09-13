import { StatusBar } from 'expo-status-bar';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { HyperliquidBtcChart } from './src/features/btc-chart';
import { BtcMarketHeader } from './src/features/btc-market';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
        >
          <BtcMarketHeader />
          <HyperliquidBtcChart />
        </ScrollView>
        <StatusBar style="light" />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  content: {
    backgroundColor: '#07151B',
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#07151B',
    paddingTop:
      Platform.OS === 'android' ? (NativeStatusBar.currentHeight ?? 0) : 0,
  },
  root: {
    backgroundColor: '#07151B',
    flex: 1,
  },
});
