function DefaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="text-black p-4">
        <p>0.9.4</p>
        <h1 className="text-2xl font-bold">Returns App Beta</h1>
      </header>
      <main className="flex-grow p-4">{children}</main>
      <footer className="bg-gray-200 text-center p-4">
        &copy; {new Date().getFullYear()} Techra. All rights reserved.
      </footer>
    </div>
  );
}

export default DefaultLayout;
