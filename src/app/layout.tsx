import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { getCurriculum } from "@/lib/curriculum";

export const metadata: Metadata = {
  title: "Ray Data Academy",
  description: "Interactive platform for learning Ray and Ray Data",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const curriculum = await getCurriculum();

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <Header />
        <div className="flex flex-1 min-h-0">
          <Sidebar curriculum={curriculum} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
