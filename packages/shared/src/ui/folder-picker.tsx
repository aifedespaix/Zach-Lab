"use client"

import * as React from "react"

import { ComboboxSelect, type ComboboxOption } from "./combobox-select"

export interface FolderNode {
  /** What `onChange` gets back — an absolute path for Mentale, any id elsewhere. */
  value: string
  name: string
  children?: FolderNode[]
}

/** Value of the « Racine » option (`allowRoot`). */
export const FOLDER_ROOT = ""

/**
 * The folders of a tree as options, depth-first: the label is the name, the
 * detail is the full path (`Collège/3e/Géométrie`), which the filter searches.
 */
export function folderPickerOptions(folders: FolderNode[], rootLabel?: string): ComboboxOption[] {
  const options: ComboboxOption[] = rootLabel === undefined ? [] : [{ value: FOLDER_ROOT, label: rootLabel, depth: 0 }]
  const walk = (nodes: FolderNode[], depth: number, parent: string) => {
    for (const node of nodes) {
      const path = parent === "" ? node.name : `${parent}/${node.name}`
      options.push({ value: node.value, label: node.name, detail: path, depth })
      walk(node.children ?? [], depth + 1, path)
    }
  }
  walk(folders, rootLabel === undefined ? 0 : 1, "")
  return options
}

interface FolderPickerProps {
  folders: FolderNode[]
  value: string | null
  onChange: (value: string) => void
  /** Offers a « Racine » option (`FOLDER_ROOT`) first. */
  allowRoot?: boolean
  rootLabel?: string
  placeholder?: string
  emptyText?: string
  ariaLabel: string
  className?: string
}

/** `ComboboxSelect` over a folder tree: indented while the filter is empty, flat with the path while typing. */
export function FolderPicker({
  folders,
  value,
  onChange,
  allowRoot = false,
  rootLabel = "Racine",
  placeholder = "Choisir un dossier…",
  emptyText = "Aucun dossier",
  ariaLabel,
  className,
}: FolderPickerProps) {
  const options = React.useMemo(() => folderPickerOptions(folders, allowRoot ? rootLabel : undefined), [folders, allowRoot, rootLabel])
  return (
    <ComboboxSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      emptyText={emptyText}
      ariaLabel={ariaLabel}
      className={className}
    />
  )
}
