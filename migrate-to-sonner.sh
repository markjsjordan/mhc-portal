#!/bin/bash
set -e
files=$(grep -rl "from 'react-hot-toast'" packages/web/src --include="*.tsx" --include="*.ts" || true)
for file in $files; do
  sed -i.bak "s|import toast from 'react-hot-toast';|import { toast } from 'sonner';|g" "$file"
  sed -i.bak "s|import { Toaster } from 'react-hot-toast';|import { Toaster } from 'sonner';|g" "$file"
  rm -f "${file}.bak"
done
echo "Migrated $(echo "$files" | wc -l) files"
