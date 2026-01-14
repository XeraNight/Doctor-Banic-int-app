import { useState } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import CalendarView from './CalendarView';
import NotesPanel from '@/components/notes/NotesPanel';

interface CalendarWithNotesProps {
  viewType: 'admin' | 'doctor' | 'patient';
}

const CalendarWithNotes = ({ viewType }: CalendarWithNotesProps) => {
  return (
    <ResizablePanelGroup direction="horizontal" className="min-h-[600px] rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm shadow-xl">
      <ResizablePanel defaultSize={70} minSize={50}>
        <div className="h-full p-4 overflow-auto">
          <CalendarView viewType={viewType} />
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle className="bg-white/20" />
      <ResizablePanel defaultSize={30} minSize={20}>
        <div className="h-full p-6 overflow-auto bg-black/10 backdrop-blur-md border-l border-white/10">
          <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
            <span className="w-2 h-8 bg-accent rounded-full inline-block"></span>
            Quick Notes
          </h3>
          <NotesPanel compact />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default CalendarWithNotes;
