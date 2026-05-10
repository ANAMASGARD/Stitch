-- CreateTable
CREATE TABLE "issue_analysis" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "issueTitle" TEXT,
    "issueUrl" TEXT,
    "classification" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "contextChunkCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_pull_request" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "commandCommentId" TEXT NOT NULL,
    "commandCommentAuthor" TEXT NOT NULL,
    "branchName" TEXT,
    "prNumber" INTEGER,
    "prUrl" TEXT,
    "status" TEXT NOT NULL,
    "planJson" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_pull_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issue_analysis_repositoryId_issueNumber_key" ON "issue_analysis"("repositoryId", "issueNumber");

-- CreateIndex
CREATE INDEX "issue_analysis_repositoryId_idx" ON "issue_analysis"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "auto_pull_request_commandCommentId_key" ON "auto_pull_request"("commandCommentId");

-- CreateIndex
CREATE INDEX "auto_pull_request_repositoryId_issueNumber_idx" ON "auto_pull_request"("repositoryId", "issueNumber");

-- AddForeignKey
ALTER TABLE "issue_analysis" ADD CONSTRAINT "issue_analysis_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_pull_request" ADD CONSTRAINT "auto_pull_request_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
