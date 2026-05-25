import { Suspense } from 'react';
import SearchContent from './SearchContent';

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-center py-8 text-gray-500">加载中...</div>}>
      <SearchContent />
    </Suspense>
  );
}
