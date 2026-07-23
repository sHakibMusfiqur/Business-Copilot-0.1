import { motion } from 'framer-motion';
import { Clock, Inbox } from 'lucide-react';

import { formatDateTime } from '@/lib/utils';
import type { RecentActivityItem } from './types';

interface ActivityTimelineProps {
  activities: RecentActivityItem[];
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="glass-card rounded-xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        {activities.length > 0 && (
          <span className="text-xs text-muted-foreground">{activities.length} items</span>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <Inbox className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">No recent activity</p>
          <p className="text-xs mt-1">Activity from your team will appear here</p>
        </div>
      ) : (
        <div className="space-y-0">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className="flex gap-3 pb-4 relative"
            >
              <div className="flex flex-col items-center">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                {index < activities.length - 1 && (
                  <div className="w-px flex-1 bg-border mt-1" />
                )}
              </div>
              <div className="flex-1 min-w-0 pt-1.5">
                <p className="text-sm font-medium truncate">{activity.action}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activity.user?.name ?? 'System'} &middot; {formatDateTime(activity.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
