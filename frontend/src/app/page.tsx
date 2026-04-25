"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ProjectList } from "@/components/dashboard/ProjectList";
import { ProjectDetail } from "@/components/dashboard/ProjectDetail";
import { LoginForm } from "@/components/dashboard/LoginForm";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!isAuthenticated) {
    return <LoginForm onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 overflow-auto p-6">
          {selectedProjectId ? (
            <ProjectDetail projectId={selectedProjectId} />
          ) : (
            <ProjectList onSelectProject={setSelectedProjectId} />
          )}
        </main>
      </div>
    </div>
  );
}
