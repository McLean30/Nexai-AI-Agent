"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { CSVUploader } from "./csv-uploader";
import { UnifiedEnrichmentView } from "./unified-enrichment-view";
import { EnrichmentTable } from "./enrichment-table";
import { CSVRow, EnrichmentField } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function CSVEnrichmentPage() {
  const [step, setStep] = useState<"upload" | "setup" | "enrichment">("upload");
  const [csvData, setCsvData] = useState<{
    rows: CSVRow[];
    columns: string[];
  } | null>(null);
  const [emailColumn, setEmailColumn] = useState<string>("");
  const [selectedFields, setSelectedFields] = useState<EnrichmentField[]>([]);
  const [isCheckingEnv, setIsCheckingEnv] = useState(true);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [missingKeys, setMissingKeys] = useState<{
    firecrawl: boolean;
    openai: boolean;
  }>({ firecrawl: false, openai: false });
  const [pendingCSVData, setPendingCSVData] = useState<{
    rows: CSVRow[];
    columns: string[];
  } | null>(null);

  // Check environment status on component mount
  useEffect(() => {
    const checkEnvironment = async () => {
      try {
        const response = await fetch("/api/check-env");
        if (!response.ok) {
          throw new Error("Failed to check environment");
        }
        // Credentials live server-side only. We only read connection status
        // here — never keys — and never touch the browser for key storage.
        await response.json();
      } catch (error) {
        console.error("Error checking environment:", error);
      } finally {
        setIsCheckingEnv(false);
      }
    };

    checkEnvironment();
  }, []);

  const handleCSVUpload = async (rows: CSVRow[], columns: string[]) => {
    // Check if we have Firecrawl API key
    const response = await fetch("/api/check-env");
    const data = await response.json();
    const hasFirecrawl = data.environmentStatus.FIRECRAWL_API_KEY;
    const hasOpenAI = data.environmentStatus.OPENAI_API_KEY;

    if (!hasFirecrawl || !hasOpenAI) {
      // Keys are configured on the server only. Show an informational
      // "not connected" dialog instead of collecting keys in the browser.
      setPendingCSVData({ rows, columns });
      setMissingKeys({ firecrawl: !hasFirecrawl, openai: !hasOpenAI });
      setShowApiKeyModal(true);
    } else {
      setCsvData({ rows, columns });
      setStep("setup");
    }
  };

  const handleStartEnrichment = (email: string, fields: EnrichmentField[]) => {
    setEmailColumn(email);
    setSelectedFields(fields);
    setStep("enrichment");
  };

  const handleBack = () => {
    if (step === "setup") {
      setStep("upload");
    } else if (step === "enrichment") {
      setStep("setup");
    }
  };

  const resetProcess = () => {
    setStep("upload");
    setCsvData(null);
    setEmailColumn("");
    setSelectedFields([]);
  };

  // Allow previewing the CSV flow even when research is not connected. No keys
  // are collected in the browser — connect them on the server.
  const handleContinueWithoutKeys = () => {
    setShowApiKeyModal(false);
    if (pendingCSVData) {
      setCsvData(pendingCSVData);
      setStep("setup");
      setPendingCSVData(null);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 max-w-7xl mx-auto font-inter">
      <div className="flex justify-between items-center">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/nexai-mark.webp"
            alt="Nexai Digital"
            width={28}
            height={34}
            className="object-contain"
          />
          <span className="text-lg font-semibold tracking-tight text-[#36322F] dark:text-white">
            Nexai <span className="text-sky-500">Digital</span>
          </span>
        </Link>
        <Button
          asChild
          variant="code"
          className="font-medium flex items-center gap-2"
        >
          <Link href="/dashboard">← Back to dashboard</Link>
        </Button>
      </div>

      <div className="text-center pt-8 pb-6">
        <h1 className="text-[2.5rem] lg:text-[3.8rem] text-[#36322F] dark:text-white font-semibold tracking-tight leading-[0.9] opacity-0 animate-fade-up [animation-duration:500ms] [animation-delay:200ms] [animation-fill-mode:forwards]">
          <span className="relative px-1 text-transparent bg-clip-text bg-gradient-to-tr from-blue-600 to-sky-400 inline-flex justify-center items-center">
            Prospect Research
          </span>
          <span className="block leading-[1.1] opacity-0 animate-fade-up [animation-duration:500ms] [animation-delay:400ms] [animation-fill-mode:forwards]">
            Drag, Drop, Enrich.
          </span>
        </h1>
      </div>

      {/* Main Content */}
      {isCheckingEnv ? (
        <div className="text-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Initializing...</p>
        </div>
      ) : (
        <div className="bg-[#FBFAF9] p-4 sm:p-6 rounded-lg shadow-sm">
          {step === "setup" && (
            <Button
              variant="code"
              size="sm"
              onClick={handleBack}
              className="mb-4 flex items-center gap-1.5"
            >
              <ArrowLeft size={16} />
              Back
            </Button>
          )}

          {step === "upload" && <CSVUploader onUpload={handleCSVUpload} />}

          {step === "setup" && csvData && (
            <UnifiedEnrichmentView
              rows={csvData.rows}
              columns={csvData.columns}
              onStartEnrichment={handleStartEnrichment}
            />
          )}

          {step === "enrichment" && csvData && (
            <>
              <div className="mb-4">
                <h2 className="text-xl font-semibold mb-1">
                  Enrichment Results
                </h2>
                <p className="text-sm text-muted-foreground">
                  Click on any row to view detailed information
                </p>
              </div>
              <EnrichmentTable
                rows={csvData.rows}
                fields={selectedFields}
                emailColumn={emailColumn}
              />
              <div className="mt-6 text-center">
                <Button variant="orange" onClick={resetProcess}>
                  Start New Enrichment
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <footer className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">
        <p>
          Powered by{" "}
          <Link
            href="https://www.firecrawl.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium"
          >
            Firecrawl
          </Link>
          {" and "}
          <Link
            href="https://openai.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 font-medium"
          >
            OpenAI
          </Link>
        </p>
      </footer>

      {/* API Key Modal */}
      <Dialog open={showApiKeyModal} onOpenChange={setShowApiKeyModal}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle>Research not connected</DialogTitle>
            <DialogDescription>
              Live enrichment needs {missingKeys.firecrawl && "Firecrawl"}
              {missingKeys.firecrawl && missingKeys.openai && " and "}
              {missingKeys.openai && "OpenAI"} configured as server-side
              credentials. For security, API keys are never entered in the
              browser.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4 text-sm text-zinc-600 dark:text-zinc-300">
            <p>
              Add the required keys to the server environment (<code>.env.local</code>
              {" "}or the hosting environment), then restart the app. Missing keys to
              configure:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              {missingKeys.firecrawl && (
                <li>
                  <code>FIRECRAWL_API_KEY</code> —{" "}
                  <a
                    href="https://www.firecrawl.dev/app/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline inline-flex items-center gap-1"
                  >
                    get key <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              )}
              {missingKeys.openai && (
                <li>
                  <code>OPENAI_API_KEY</code> —{" "}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline inline-flex items-center gap-1"
                  >
                    get key <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              )}
            </ul>
            <p className="text-xs text-zinc-500">
              You can still preview the enrichment setup, but no live data will be
              fetched until the server is connected.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApiKeyModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleContinueWithoutKeys} variant="code">
              Preview setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
