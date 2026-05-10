"use client";

import { ProfileForm } from "@/module/settings/components/profile-form";
import { GithubPermissionsCard } from "@/module/settings/components/github-permissions-card";
import React from "react";
import { RepositoryList } from "@/module/settings/components/repository-list";

const SettingPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and connected repositories
        </p>
      </div>
      <ProfileForm />
      <GithubPermissionsCard />
      <RepositoryList />
    </div>
  );
};

export default SettingPage