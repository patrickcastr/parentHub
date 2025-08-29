import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function ImportStudentsCsv({ onImport }: { onImport: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      toast.success("CSV uploaded. Processing...");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="csv-upload" className="font-medium">Import Students (CSV)</label>
      <input
        ref={inputRef}
        id="csv-upload"
        type="file"
        accept=".csv"
        className="border p-2 rounded"
        onChange={handleFileChange}
      />
      <Button onClick={() => inputRef.current?.click()}>Upload CSV</Button>
    </div>
  );
}
