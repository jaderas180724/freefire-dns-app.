"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Radio,
  Key,
  Activity,
  ArrowRight,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  slug: string;
  master_switch: boolean;
  key_count: string;
  created_at: string;
}

interface ProjectListProps {
  onSelectProject: (id: string) => void;
}

export function ProjectList({ onSelectProject }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem("devflow_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch {
      // Handle error
    }
  };

  const createProject = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("devflow_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: newName, description: newDesc }),
        }
      );
      if (res.ok) {
        setNewName("");
        setNewDesc("");
        setShowCreate(false);
        fetchProjects();
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Projects</h2>
          <p className="text-muted-foreground">
            Manage your API interception projects
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Create Project Dialog */}
      {showCreate && (
        <Card className="mb-6 border-primary/50 glow-blue">
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
            <CardDescription>
              Set up a new API interception project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Project Name
              </label>
              <Input
                placeholder="My iOS App"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Description
              </label>
              <Input
                placeholder="A/B testing for feature flags..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={createProject} disabled={loading}>
                {loading ? "Creating..." : "Create Project"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <Card
            key={project.id}
            className="group cursor-pointer hover:border-primary/50 transition-all duration-200"
            onClick={() => onSelectProject(project.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Radio
                    className={
                      project.master_switch
                        ? "h-4 w-4 text-green-400"
                        : "h-4 w-4 text-muted-foreground"
                    }
                  />
                  <CardTitle className="text-base">{project.name}</CardTitle>
                </div>
                <Badge
                  variant={project.master_switch ? "success" : "secondary"}
                >
                  {project.master_switch ? "Active" : "Inactive"}
                </Badge>
              </div>
              {project.description && (
                <CardDescription className="line-clamp-2">
                  {project.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Key className="h-3 w-3" />
                  {project.key_count} keys
                </span>
                <span className="flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  {project.slug}
                </span>
              </div>
              <div className="flex items-center text-primary text-sm mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                Open project
                <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            </CardContent>
          </Card>
        ))}

        {projects.length === 0 && !showCreate && (
          <Card className="col-span-full border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first project to start intercepting API responses
              </p>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}
