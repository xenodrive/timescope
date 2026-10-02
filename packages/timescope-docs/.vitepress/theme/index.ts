import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import ApiCode from './components/api/ApiCode.vue';
import ApiEntry from './components/api/ApiEntry.vue';
import ApiMember from './components/api/ApiMember.vue';
import ApiParameters from './components/api/ApiParameters.vue';
import ApiSignature from './components/api/ApiSignature.vue';
import ApiTable from './components/api/ApiTable.vue';
import MyLayout from './MyLayout.vue';

export default {
  extends: DefaultTheme,
  Layout: MyLayout,
  enhanceApp({ app }) {
    app.component('ApiCode', ApiCode);
    app.component('ApiEntry', ApiEntry);
    app.component('ApiMember', ApiMember);
    app.component('ApiParameters', ApiParameters);
    app.component('ApiSignature', ApiSignature);
    app.component('ApiTable', ApiTable);
  },
} satisfies Theme;
