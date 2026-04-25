"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  FolderKanban,
  Settings,
  BarChart3,
  Plus,
  ChevronLeft,
  ChevronRight,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  master_switch: boolean;
  slug: string;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
}

export function Sidebar({
  isOpen,
  onToggle,
  selectedProjectId,
  onSelectProject,
}: SidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem("devflow_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch {
      // Silently handle error
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-card border-r border-border transition-all duration-300",
        isOpen ? "w-64" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-primary-foreground" />
        </div>
        {isOpen && (
          <span className="font-bold text-lg whitespace-nowrap">DevFlow</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7"
          onClick={onToggle}
        >
          {isOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        <Button
          variant={selectedProjectId === null ? "secondary" : "ghost"}
          className={cn("w-full justify-start", !isOpen && "justify-center")}
          onClick={() => onSelectProject(null)}
        >
          <FolderKanban className="h-4 w-4 flex-shrink-0" />
          {isOpen && <span className="ml-2">All Projects</span>}
        </Button>

        {isOpen && (
          <div className="pt-4">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Projects
              </span>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {projects.map((project) => (
              <Button
                key={project.id}
                variant={
                  selectedProjectId === project.id ? "secondary" : "ghost"
                }
                className="w-full justify-start text-sm"
                onClick={() => onSelectProject(project.id)}
              >
                <Radio
                  className={cn(
                    "h-3 w-3 flex-shrink-0 mr-2",
                    project.master_switch
                      ? "text-green-400"
                      : "text-muted-foreground"
                  )}
                />
                <span className="truncate">{project.name}</span>
                {project.master_switch && (
                  <Badge variant="success" className="ml-auto text-[10px] px-1">
                    ON
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom links */}
      <div className="p-2 border-t border-border space-y-1">
        <Button
          variant="ghost"
          className={cn("w-full justify-start", !isOpen && "justify-center")}
        >
          <BarChart3 className="h-4 w-4 flex-shrink-0" />
          {isOpen && <span className="ml-2">Analytics</span>}
        </Button>
        <Button
          variant="ghost"
          className={cn("w-full justify-start", !isOpen && "justify-center")}
        >
          <Settings className="h-4 w-4 flex-shrink-0" />
          {isOpen && <span className="ml-2">Settings</span>}
        </Button>
      </div>
    </div>
  );
}
