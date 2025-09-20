'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/DataTable';
import Image from 'next/image';
import React from 'react';

// Types for participants
export type User = {
  userId: string;
  name: string;
  screenName: string;
  description: string;
  website: string;
  location: string;
  followersCount: number;
  friendsCount: number;
  profileImageUrlHttps: string;
  profileBannerUrl: string;
  kolFollowersCount: number;
  tweetCount: number;
  percentage: number;
};

export type ParticipantsData = User[];

type ParticipantsTableProps = {
  data: ParticipantsData;
  isLoading?: boolean;
  isError?: boolean;
};

// Rank cell component
const RankCell = ({ index }: { index: number }) => (
  <div className="text-center w-10">
    <span className="font-semibold text-sm">
      #
      {index + 1}
    </span>
  </div>
);

// Name cell component with avatar
const NameCell = ({ user }: { user: User }) => (
  <div className="flex items-center gap-2 min-w-0 w-36">
    <Image
      src={user.profileImageUrlHttps || '/default-avatar.png'}
      alt={user.name}
      width={28}
      height={28}
      className="w-7 h-7 rounded-full flex-shrink-0"
    />
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium truncate">{user.name}</p>
      <p className="text-xs text-muted-foreground truncate">
        @
        {user.screenName}
      </p>
    </div>
  </div>
);

// Mind share cell component
const MindShareCell = ({ percentage }: { percentage: number }) => (
  <div className="text-center w-14">
    <span className="text-xs font-medium">
      {percentage.toFixed(1)}
      %
    </span>
  </div>
);

// Influencer followers cell component
const InfluencerFollowersCell = ({ count }: { count: number }) => (
  <div className="text-center w-16">
    <span className="text-xs">{count.toLocaleString()}</span>
  </div>
);

export default function ParticipantsTable({ data, isLoading = false, isError = false }: ParticipantsTableProps) {
  // Define columns for the table
  const columns: ColumnDef<User, unknown>[] = [
    {
      id: 'rank',
      header: () => <div className="text-center w-10 text-xs">Rank</div>,
      cell: ({ row }) => <RankCell index={row.index} />,
    },
    {
      accessorKey: 'name',
      header: () => <div className="w-36 text-xs">Name</div>,
      cell: ({ row }) => <NameCell user={row.original} />,
    },
    {
      accessorKey: 'percentage',
      header: () => <div className="text-center w-14 text-xs">Mind Share</div>,
      cell: ({ row }) => <MindShareCell percentage={row.original.percentage} />,
    },
    {
      accessorKey: 'kolFollowersCount',
      header: () => <div className="text-center w-16 text-xs">Inf. Followers</div>,
      cell: ({ row }) => <InfluencerFollowersCell count={row.original.kolFollowersCount} />,
    },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3 h-[590px] p-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-10 h-4 bg-muted rounded" />
            <div className="w-7 h-7 bg-muted rounded-full" />
            <div className="flex-1 space-y-1 max-w-36">
              <div className="h-3 bg-muted rounded w-20" />
              <div className="h-3 bg-muted rounded w-14" />
            </div>
            <div className="w-14 h-4 bg-muted rounded" />
            <div className="w-16 h-4 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="text-red-500 text-center py-8 h-32 flex items-center justify-center">
        Failed to load participants
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-8 h-32 flex items-center justify-center">
        No participants yet
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden">
      <style jsx>
        {`
        .participants-table table {
          table-layout: fixed;
          width: 100%;
        }
        .participants-table th:nth-child(1),
        .participants-table td:nth-child(1) {
          width: 2.5rem;
        }
        .participants-table th:nth-child(2),
        .participants-table td:nth-child(2) {
          width: 9rem;
        }
        .participants-table th:nth-child(3),
        .participants-table td:nth-child(3) {
          width: 3.5rem;
        }
        .participants-table th:nth-child(4),
        .participants-table td:nth-child(4) {
          width: 4rem;
        }
      `}
      </style>
      <div className="participants-table">
        <DataTable
          columns={columns}
          data={data} // Show all participants
          maxHeight="590px" // Fixed height to match CampaignTweets
          showPagination={false}
        />
      </div>
    </div>
  );
}
