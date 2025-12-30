/**
 * useHistory Hook
 *
 * Manages undo/redo history stack using the command pattern.
 * Each action is recorded and can be undone/redone.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * A command that can be executed, undone, and redone
 */
export interface Command<T = unknown> {
  /** Unique identifier for this command */
  id: string;
  /** Type of command for debugging/display */
  type: string;
  /** Human-readable description */
  description: string;
  /** Execute the command (called on initial execution and redo) */
  execute: () => T;
  /** Undo the command */
  undo: () => void;
  /** Optional: Custom redo if different from execute */
  redo?: () => T;
}

/**
 * History state
 */
export interface HistoryState {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Number of items in undo stack */
  undoCount: number;
  /** Number of items in redo stack */
  redoCount: number;
  /** Description of next undo action */
  nextUndo: string | null;
  /** Description of next redo action */
  nextRedo: string | null;
}

interface UseHistoryOptions {
  /** Maximum number of commands to keep in history */
  maxHistory?: number;
  /** Called when history state changes */
  onHistoryChange?: (state: HistoryState) => void;
}

interface UseHistoryReturn {
  /** Current history state */
  state: HistoryState;
  /** Execute a command and add to history */
  execute: <T>(command: Command<T>) => T;
  /** Undo the last command */
  undo: () => void;
  /** Redo the last undone command */
  redo: () => void;
  /** Clear all history */
  clear: () => void;
  /** Create a transaction (batch multiple commands) */
  startTransaction: (description: string) => void;
  /** Commit the current transaction */
  commitTransaction: () => void;
  /** Cancel the current transaction (undoes all commands in it) */
  cancelTransaction: () => void;
  /** Whether currently in a transaction */
  inTransaction: boolean;
}

/**
 * Generate unique command ID
 */
function generateCommandId(): string {
  return `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook for managing undo/redo history
 */
export function useHistory(options: UseHistoryOptions = {}): UseHistoryReturn {
  const { maxHistory = 100, onHistoryChange } = options;

  const [undoStack, setUndoStack] = useState<Command[]>([]);
  const [redoStack, setRedoStack] = useState<Command[]>([]);

  // Transaction state
  const transactionRef = useRef<{
    description: string;
    commands: Command[];
  } | null>(null);

  // Calculate current state
  const state: HistoryState = {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
    nextUndo: undoStack.length > 0 ? undoStack[undoStack.length - 1].description : null,
    nextRedo: redoStack.length > 0 ? redoStack[redoStack.length - 1].description : null,
  };

  // Notify on state change
  useEffect(() => {
    onHistoryChange?.(state);
  }, [undoStack.length, redoStack.length]);

  // Execute a command
  const execute = useCallback(<T,>(command: Command<T>): T => {
    // Assign ID if not present
    const cmdWithId = {
      ...command,
      id: command.id || generateCommandId(),
    };

    // Execute the command
    const result = cmdWithId.execute();

    // If in a transaction, add to transaction commands
    if (transactionRef.current) {
      transactionRef.current.commands.push(cmdWithId);
      return result;
    }

    // Add to undo stack
    setUndoStack((prev) => {
      const newStack = [...prev, cmdWithId];
      // Trim if exceeds max history
      if (newStack.length > maxHistory) {
        return newStack.slice(newStack.length - maxHistory);
      }
      return newStack;
    });

    // Clear redo stack (new action invalidates redo history)
    setRedoStack([]);

    return result;
  }, [maxHistory]);

  // Undo last command
  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;

      const lastCommand = prev[prev.length - 1];
      lastCommand.undo();

      // Move to redo stack
      setRedoStack((redoPrev) => [...redoPrev, lastCommand]);

      return prev.slice(0, -1);
    });
  }, []);

  // Redo last undone command
  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;

      const lastCommand = prev[prev.length - 1];

      // Use custom redo if available, otherwise execute
      if (lastCommand.redo) {
        lastCommand.redo();
      } else {
        lastCommand.execute();
      }

      // Move to undo stack
      setUndoStack((undoPrev) => [...undoPrev, lastCommand]);

      return prev.slice(0, -1);
    });
  }, []);

  // Clear all history
  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
    transactionRef.current = null;
  }, []);

  // Start a transaction
  const startTransaction = useCallback((description: string) => {
    if (transactionRef.current) {
      console.warn('Already in a transaction. Commit or cancel first.');
      return;
    }
    transactionRef.current = {
      description,
      commands: [],
    };
  }, []);

  // Commit transaction
  const commitTransaction = useCallback(() => {
    if (!transactionRef.current) {
      console.warn('No transaction to commit.');
      return;
    }

    const { description, commands } = transactionRef.current;
    transactionRef.current = null;

    if (commands.length === 0) return;

    // Create a compound command
    const compoundCommand: Command = {
      id: generateCommandId(),
      type: 'transaction',
      description,
      execute: () => {
        // Already executed
      },
      undo: () => {
        // Undo in reverse order
        for (let i = commands.length - 1; i >= 0; i--) {
          commands[i].undo();
        }
      },
      redo: () => {
        // Redo in forward order
        for (const cmd of commands) {
          if (cmd.redo) {
            cmd.redo();
          } else {
            cmd.execute();
          }
        }
      },
    };

    setUndoStack((prev) => {
      const newStack = [...prev, compoundCommand];
      if (newStack.length > maxHistory) {
        return newStack.slice(newStack.length - maxHistory);
      }
      return newStack;
    });

    setRedoStack([]);
  }, [maxHistory]);

  // Cancel transaction
  const cancelTransaction = useCallback(() => {
    if (!transactionRef.current) {
      console.warn('No transaction to cancel.');
      return;
    }

    const { commands } = transactionRef.current;
    transactionRef.current = null;

    // Undo all commands in reverse order
    for (let i = commands.length - 1; i >= 0; i--) {
      commands[i].undo();
    }
  }, []);

  return {
    state,
    execute,
    undo,
    redo,
    clear,
    startTransaction,
    commitTransaction,
    cancelTransaction,
    inTransaction: transactionRef.current !== null,
  };
}

/**
 * Create a simple command
 */
export function createCommand<T>(
  type: string,
  description: string,
  execute: () => T,
  undo: () => void,
  redo?: () => T
): Command<T> {
  return {
    id: generateCommandId(),
    type,
    description,
    execute,
    undo,
    redo,
  };
}

export default useHistory;
