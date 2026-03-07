import React from 'react';

interface GroupHomeFilterProps {
    homes: { id: string; name: string }[];
    selectedHomeId: string | null;
    onSelect: (id: string | null) => void;
}

export function GroupHomeFilter({ homes, selectedHomeId, onSelect }: GroupHomeFilterProps) {
    return (
        <select
            value={selectedHomeId ?? ''}
            onChange={(e) => onSelect(e.target.value || null)}
            style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                fontSize: '0.82rem',
                color: '#1e293b',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontWeight: 500,
                cursor: 'pointer',
                minWidth: '180px',
            }}
        >
            <option value="">All Homes</option>
            {homes.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
            ))}
        </select>
    );
}
