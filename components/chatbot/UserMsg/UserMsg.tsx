"use client";

import React from "react";

interface UserMsgProps {
  message: string;
  timestamp?: string;
}

export default function UserMsg({ message, timestamp }: UserMsgProps) {
  return (
    <div className="group flex flex-col items-end self-end ml-auto max-w-[88%] sm:max-w-[80%] stc-rise">
      <div className="px-4 py-2.5 rounded-[20px] bg-[#f1f2f1] text-ink text-[15px] leading-[1.6] whitespace-pre-wrap break-words">
        {message}
      </div>
      {timestamp && (
        <span className="text-[11px] text-ink-subtle mt-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {timestamp}
        </span>
      )}
    </div>
  );
}
