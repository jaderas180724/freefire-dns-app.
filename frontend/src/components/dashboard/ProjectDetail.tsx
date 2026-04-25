"use client";

import { useState, useEffect, useCallback } from "react";
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
import { JsonEditor } from "@/components/editor/JsonEditor";
import {
  Power,
  Key,
  Plus,
  Trash2,
  Download,
  Copy,
  RefreshCw,
  History,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  description: string;
  slug: string;
  master_switch: boolean;
  injection_value: string;
  json_template: Record<string, unknown>;
  proxy_subdomain: string;
}

interface TargetKey {
  id: string;
  key_path: string;
  description: string;
  is_active: boolean;
}

interface InjectionHistoryItem {
  id: string;
  injection_value: string;
  used_at: string;
}

interface ProjectDetailProps {
  projectId: string;
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [targetKeys, setTargetKeys] = useState<TargetKey[]>([]);
  const [injectionHistory, setInjectionHistory] = useState<InjectionHistoryItem[]>([]);
  const [injectionValue, setInjectionValue] = useState("");
  const [newKeyPath, setNewKeyPath] = useState("");
  const [newKeyDesc, setNewKeyDesc] = useState("");
  const [jsonTemplate, setJsonTemplate] = useState("{}");
  const [loading, setLoading] = useState(true);

  const token = typeof window !== "undefined" ? localStorage.getItem("devflow_token") : null;

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setTargetKeys(data.targetKeys || []);
        setInjectionHistory(data.injectionHistory || []);
        setInjectionValue(data.project.injection_value || "");
        setJsonTemplate(
          JSON.stringify(data.project.json_template || {}, null, 2)
        );
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const toggleMasterSwitch = async () => {
    if (!project) return;
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${projectId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ masterSwitch: !project.master_switch }),
        }
      );
      fetchProject();
    } catch {
      // Handle error
    }
  };

  const updateInjectionValue = async () => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${projectId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ injectionValue }),
        }
      );
      fetchProject();
    } catch {
      // Handle error
    }
  };

  const updateJsonTemplate = async () => {
    try {
      const parsed = JSON.parse(jsonTemplate);
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${projectId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ jsonTemplate: parsed }),
        }
      );
      fetchProject();
    } catch {
      // Handle JSON parse error
    }
  };

  const addTargetKey = async () => {
    if (!newKeyPath.trim()) return;
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${projectId}/keys`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            keyPath: newKeyPath,
            description: newKeyDesc,
          }),
        }
      );
      setNewKeyPath("");
      setNewKeyDesc("");
      fetchProject();
    } catch {
      // Handle error
    }
  };

  const deleteTargetKey = async (keyId: string) => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${projectId}/keys/${keyId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      fetchProject();
    } catch {
      // Handle error
    }
  };

  const downloadProfile = () => {
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/profiles/ios/${projectId}`,
      "_blank"
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Project Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            {project.name}
            <Badge
              variant={project.master_switch ? "success" : "secondary"}
              className="text-xs"
            >
              {project.master_switch ? "ACTIVE" : "INACTIVE"}
            </Badge>
          </h2>
          <p className="text-muted-foreground mt-1">{project.description}</p>
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            Proxy: {project.proxy_subdomain}.devflowlabs.io
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadProfile}>
            <Smartphone className="mr-2 h-4 w-4" />
            Generate iOS Profile
          </Button>
        </div>
      </div>

      {/* Master Switch */}
      <Card
        className={cn(
          "transition-all duration-300",
          project.master_switch
            ? "border-green-500/50 glow-green"
            : "border-border"
        )}
      >
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Power
              className={cn(
                "h-5 w-5",
                project.master_switch ? "text-green-400" : "text-muted-foreground"
              )}
            />
            <div>
              <p className="font-semibold">Master Switch</p>
              <p className="text-sm text-muted-foreground">
                {project.master_switch
                  ? "API responses are being intercepted and modified"
                  : "All requests are passing through unmodified"}
              </p>
            </div>
          </div>
          <Button
            variant={project.master_switch ? "destructive" : "default"}
            onClick={toggleMasterSwitch}
          >
            {project.master_switch ? "Deactivate" : "Activate"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* JSON Template Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">JSON Template</CardTitle>
            <CardDescription>
              Paste your API response template for reference
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-64 border rounded-md overflow-hidden">
              <JsonEditor value={jsonTemplate} onChange={setJsonTemplate} />
            </div>
            <Button size="sm" onClick={updateJsonTemplate}>
              Save Template
            </Button>
          </CardContent>
        </Card>

        {/* Injection Value */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Injection Value</CardTitle>
              <CardDescription>
                Value to inject into target keys
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Enter injection value..."
                value={injectionValue}
                onChange={(e) => setInjectionValue(e.target.value)}
                className="font-mono"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={updateInjectionValue}>
                  Update Value
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(injectionValue);
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Injection History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Value History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {injectionHistory.map((item) => (
                  <button
                    key={item.id}
                    className="flex items-center justify-between w-full text-left px-2 py-1.5 rounded text-sm hover:bg-secondary/50 transition-colors"
                    onClick={() => setInjectionValue(item.injection_value)}
                  >
                    <span className="font-mono truncate mr-2">
                      {item.injection_value}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(item.used_at).toLocaleDateString()}
                    </span>
                  </button>
                ))}
                {injectionHistory.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No history yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Target Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Target Keys
          </CardTitle>
          <CardDescription>
            JSON paths that will be replaced with the injection value
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Key */}
          <div className="flex gap-2">
            <Input
              placeholder="e.g. user.subscription.plan"
              value={newKeyPath}
              onChange={(e) => setNewKeyPath(e.target.value)}
              className="font-mono flex-1"
            />
            <Input
              placeholder="Description (optional)"
              value={newKeyDesc}
              onChange={(e) => setNewKeyDesc(e.target.value)}
              className="flex-1"
            />
            <Button onClick={addTargetKey}>
              <Plus className="mr-2 h-4 w-4" />
              Add Key
            </Button>
          </div>

          {/* Key List */}
          <div className="space-y-2">
            {targetKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between px-3 py-2 bg-secondary/30 rounded-md"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant={key.is_active ? "success" : "secondary"}
                    className="text-[10px]"
                  >
                    {key.is_active ? "ON" : "OFF"}
                  </Badge>
                  <code className="text-sm font-mono">{key.key_path}</code>
                  {key.description && (
                    <span className="text-xs text-muted-foreground">
                      — {key.description}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => deleteTargetKey(key.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {targetKeys.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No target keys configured. Add keys to start intercepting API
                responses.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* iOS Profile Download */}
      <Card className="border-primary/30">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">iOS Configuration Profile</p>
              <p className="text-sm text-muted-foreground">
                Download .mobileconfig to route traffic through DevFlow proxy
              </p>
            </div>
          </div>
          <Button onClick={downloadProfile}>
            <Smartphone className="mr-2 h-4 w-4" />
            Generate Profile
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
