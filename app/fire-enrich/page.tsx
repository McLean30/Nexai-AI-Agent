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
        <Link
          href="https://www.firecrawl.dev/?utm_source=tool-csv-enrichment"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            src="/firecrawl-logo-with-fire.png"
            alt="Firecrawl Logo"
            width={113}
            height={24}
          />
        </Link>
        <Button
          asChild
          variant="code"
          className="font-medium flex items-center gap-2"
        >
          <a
            href="https://github.com/mendableai/firecrawl/tree/main/examples"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Use this template
          </a>
        </Button>
      </div>

      <div className="text-center pt-8 pb-6">
        <h1 className="text-[2.5rem] lg:text-[3.8rem] text-[#36322F] dark:text-white font-semibold tracking-tight leading-[0.9] opacity-0 animate-fade-up [animation-duration:500ms] [animation-delay:200ms] [animation-fill-mode:forwards]">
          <span className="relative px-1 text-transparent bg-clip-text bg-gradient-to-tr from-red-600 to-yellow-500 inline-flex justify-center items-center">
            Fire Enrich v2
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
