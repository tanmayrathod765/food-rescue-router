export default function Loader({ text = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">{text}</p>
      </div>
    </div>
  )
}