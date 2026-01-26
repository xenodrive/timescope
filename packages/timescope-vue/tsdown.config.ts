import { defineConfig } from 'tsdown';
import Vue from 'unplugin-vue/rolldown';
import { getCommonConfig } from '../../tsdown.config.common.ts';

const { configBase } = getCommonConfig(import.meta.dirname, {
  plugins: [Vue()],
  dts: { vue: true },
});

export default defineConfig(configBase);
