export default function NFTSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-black/10 rounded-lg overflow-hidden">
        <div className="w-full aspect-square bg-gray-300" />
        <div className="p-4">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-300 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
} 