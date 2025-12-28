import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-white tracking-tight">
              Turn Your Digital Chaos Into
              <span className="block text-primary-300">A Beautiful Life Story</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-primary-100 max-w-2xl mx-auto">
              Upload your decades of files—photos, documents, videos—and let AI
              transform them into a stunning, shareable autobiography.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth" className="btn-primary text-lg px-8 py-3">
                Get Started Free
              </Link>
              <Link href="#how-it-works" className="btn bg-white/10 text-white hover:bg-white/20 text-lg px-8 py-3">
                See How It Works
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-gray-900">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              From scattered files to a polished life story in four simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: '1',
                title: 'Upload',
                description: 'Drag and drop your files—photos, documents, videos. We handle ZIP files too.',
                icon: '📤',
              },
              {
                step: '2',
                title: 'Discover',
                description: 'Watch AI uncover your stories, identify gems, and build your timeline.',
                icon: '🔍',
              },
              {
                step: '3',
                title: 'Curate',
                description: 'Review AI suggestions, approve your favorites, and organize chapters.',
                icon: '✨',
              },
              {
                step: '4',
                title: 'Publish',
                description: 'Get a beautiful, shareable website that tells your unique story.',
                icon: '🚀',
              },
            ].map((item) => (
              <div key={item.step} className="card p-6 text-center">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">{item.icon}</span>
                </div>
                <div className="text-sm font-medium text-primary-600 mb-2">Step {item.step}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Files */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-serif font-bold text-gray-900">
              Works With All Your Files
            </h2>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {[
              'PDF', 'Word', 'Photos', 'Videos', 'Audio', 'Text', 'ZIP'
            ].map((type) => (
              <span
                key={type}
                className="px-4 py-2 bg-white rounded-full text-gray-700 shadow-sm border border-gray-200"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-900">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-6">
            Ready to Tell Your Story?
          </h2>
          <p className="text-lg text-primary-100 mb-8">
            Start preserving your memories today. Your first autobiography is free.
          </p>
          <Link href="/auth" className="btn-primary text-lg px-8 py-3">
            Create Your Autobiography
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; {new Date().getFullYear()} Autobiography Builder. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
