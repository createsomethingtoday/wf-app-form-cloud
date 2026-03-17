import { handleRuntimeSubmit } from '../../lib/submitFormRuntime';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  return handleRuntimeSubmit(request);
}
