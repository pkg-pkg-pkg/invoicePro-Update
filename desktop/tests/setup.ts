/// <reference types="vitest" />
import { beforeEach } from 'vitest';
import './helpers/testStorage';
import { resetTestStorage } from './helpers/testStorage';

beforeEach(() => {
  resetTestStorage();
});
