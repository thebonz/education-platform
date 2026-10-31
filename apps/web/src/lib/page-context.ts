import 'server-only';
import { notFound } from 'next/navigation';
import { getMe, requestHost } from './server-api';
import { basePath, isProduct, Product } from './sites';

export async function productContext(params: Promise<{ product: string }>) {
  const { product } = await params;
  if (!isProduct(product)) notFound();
  const host = await requestHost();
  const [me] = await Promise.all([getMe()]);
  return { product: product as Product, base: basePath(product, host), me };
}

export function firstParam(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] ?? null : null;
}
