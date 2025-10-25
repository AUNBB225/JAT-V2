'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

interface CsvRow {
  id: string;
  data: string[];
  order: number | null;
  selected: boolean;
}

export default function SortCSVPage() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setMessage('');
    setSearchQuery('');

    try {
      const text = await uploadedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        setMessage('ไฟล์ว่างเปล่า');
        return;
      }

      const headerLine = lines[0].split(',').map(h => h.trim());
      setHeaders(headerLine);

      const dataRows = lines.slice(1).map((line, index) => ({
        id: `row-${index}`,
        data: line.split(',').map(d => d.trim()),
        order: null,
        selected: false,
      }));

      setRows(dataRows);
      setMessage(`อ่านไฟล์สำเร็จ: ${dataRows.length} แถว`);
    } catch (error) {
      setMessage('เกิดข้อผิดพลาดในการอ่านไฟล์');
      console.error(error);
    }
  };

  // ค้นหา
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;

    const query = searchQuery.toLowerCase();
    return rows.filter(row => 
      row.data.some(cell => cell.toLowerCase().includes(query))
    );
  }, [rows, searchQuery]);

  const handleToggleRow = (rowId: string) => {
    setRows(prevRows => {
      const row = prevRows.find(r => r.id === rowId);
      if (!row) return prevRows;

      if (row.selected) {
        const updatedRows = prevRows.map(r => {
          if (r.id === rowId) {
            return { ...r, selected: false, order: null };
          }
          if (r.order && row.order && r.order > row.order) {
            return { ...r, order: r.order - 1 };
          }
          return r;
        });
        return updatedRows;
      } else {
        const currentMaxOrder = Math.max(0, ...prevRows.filter(r => r.selected && r.order).map(r => r.order!));
        return prevRows.map(r => 
          r.id === rowId 
            ? { ...r, selected: true, order: currentMaxOrder + 1 }
            : r
        );
      }
    });
  };

  const handleDownload = () => {
    if (rows.length === 0) {
      setMessage('ไม่มีข้อมูลให้ดาวน์โหลด');
      return;
    }

    const selectedRows = rows.filter(r => r.selected && r.order !== null);
    const unselectedRows = rows.filter(r => !r.selected);
    
    const sortedSelected = selectedRows.sort((a, b) => a.order! - b.order!);
    const finalRows = [...sortedSelected, ...unselectedRows];

    const csvContent = [
      headers.join(','),
      ...finalRows.map(row => row.data.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `sorted_${file?.name || 'data.csv'}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setMessage('ดาวน์โหลดสำเร็จ');
  };

  const handleReset = () => {
    setRows(rows.map(row => ({ ...row, selected: false, order: null })));
    setMessage('รีเซ็ตการเลือกแล้ว');
  };

  const selectedCount = rows.filter(r => r.selected).length;

  return (
    <div className="container" style={{ maxWidth: '1400px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        <div>
          <Link href="/" className="btn-secondary" style={{ marginBottom: '0.75rem', display: 'inline-flex' }}>
            <i className="fas fa-arrow-left"></i> กลับ
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0 }}>จัดลำดับ CSV</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="btn-secondary" style={{ margin: 0, cursor: 'pointer' }}>
            <i className="fas fa-upload"></i> อัพโหลด CSV
          </label>
          
          {selectedCount > 0 && (
            <>
              <button onClick={handleReset} className="btn-secondary">
                <i className="fas fa-redo"></i> รีเซ็ต
              </button>
              <button onClick={handleDownload} className="btn-primary">
                <i className="fas fa-download"></i> ดาวน์โหลด ({selectedCount})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {rows.length > 0 && (
        <div style={{ 
          marginBottom: '1rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{ 
            flex: 1,
            minWidth: '300px',
            position: 'relative'
          }}>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-search" style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                pointerEvents: 'none'
              }}></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาในตาราง..."
                className="input-field"
                style={{
                  paddingLeft: '2.75rem',
                  paddingRight: searchQuery ? '2.75rem' : '1rem',
                  fontSize: '0.875rem',
                  height: '44px'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(229, 9, 20, 0.1)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--primary)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(229, 9, 20, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(229, 9, 20, 0.1)';
                  }}
                >
                  <i className="fas fa-times" style={{ fontSize: '0.75rem' }}></i>
                </button>
              )}
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: '1rem',
            alignItems: 'center',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)'
          }}>
            <span>
              <i className="fas fa-check-double" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i>
              เลือก: <strong style={{ color: 'var(--text-primary)' }}>{selectedCount}</strong>
            </span>
            <span>
              <i className="fas fa-list" style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}></i>
              แสดง: <strong style={{ color: 'var(--text-primary)' }}>{filteredRows.length}</strong> / {rows.length}
            </span>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div style={{ 
          padding: '0.75rem 1rem', 
          background: message.includes('สำเร็จ') || message.includes('อ่านไฟล์') 
            ? 'rgba(70, 211, 105, 0.1)' 
            : 'rgba(229, 9, 20, 0.1)',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontSize: '0.875rem',
          border: `1px solid ${message.includes('สำเร็จ') || message.includes('อ่านไฟล์')
            ? 'rgba(70, 211, 105, 0.3)' 
            : 'rgba(229, 9, 20, 0.3)'}`,
          color: message.includes('สำเร็จ') || message.includes('อ่านไฟล์') ? '#46d369' : '#e50914',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <i className={`fas ${message.includes('สำเร็จ') || message.includes('อ่านไฟล์') ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
          {message}
        </div>
      )}

      {/* Table */}
      {rows.length > 0 ? (
        <>
          {filteredRows.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              background: 'var(--surface)',
              borderRadius: '12px',
              border: '1px solid var(--divider)'
            }}>
              <i className="fas fa-search" style={{ 
                fontSize: '2.5rem', 
                color: 'var(--divider)',
                marginBottom: '1rem',
                display: 'block'
              }}></i>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                ไม่พบข้อมูล
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                ไม่พบข้อมูลที่ตรงกับ "{searchQuery}"
              </p>
            </div>
          ) : (
            <div style={{
              background: 'var(--surface)',
              borderRadius: '12px',
              border: '1px solid var(--divider)',
              overflow: 'hidden'
            }}>
              <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem'
                }}>
                  <thead style={{
                    position: 'sticky',
                    top: 0,
                    background: 'var(--background)',
                    zIndex: 10,
                    borderBottom: '2px solid var(--primary)'
                  }}>
                    <tr>
                      <th style={{
                        width: '50px',
                        padding: '0.75rem',
                        textAlign: 'center',
                        fontWeight: '600',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        borderRight: '1px solid var(--divider)'
                      }}>
                        #
                      </th>
                      <th style={{
                        width: '40px',
                        padding: '0.75rem',
                        textAlign: 'center',
                        fontWeight: '600',
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        borderRight: '1px solid var(--divider)'
                      }}>
                        <i className="fas fa-check"></i>
                      </th>
                      {headers.map((header, index) => (
                        <th key={index} style={{
                          padding: '0.75rem 1rem',
                          textAlign: 'left',
                          fontWeight: '600',
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase',
                          borderRight: index < headers.length - 1 ? '1px solid var(--divider)' : 'none',
                          minWidth: '120px',
                          maxWidth: '200px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const originalIndex = rows.findIndex(r => r.id === row.id);
                      return (
                        <tr
                          key={row.id}
                          onClick={() => handleToggleRow(row.id)}
                          style={{
                            cursor: 'pointer',
                            background: row.selected ? 'rgba(229, 9, 20, 0.08)' : 'transparent',
                            transition: 'all 0.2s ease',
                            borderBottom: '1px solid rgba(51, 51, 51, 0.5)'
                          }}
                          onMouseEnter={(e) => {
                            if (!row.selected) {
                              e.currentTarget.style.background = 'rgba(229, 9, 20, 0.04)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!row.selected) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          <td style={{
                            padding: '0.5rem',
                            textAlign: 'center',
                            fontWeight: '700',
                            fontSize: '0.875rem',
                            color: row.selected ? 'var(--primary)' : 'var(--text-secondary)',
                            borderRight: '1px solid var(--divider)'
                          }}>
                            {row.order || originalIndex + 1}
                          </td>

                          <td style={{
                            padding: '0.5rem',
                            textAlign: 'center',
                            borderRight: '1px solid var(--divider)'
                          }}>
                            <div style={{
                              width: '18px',
                              height: '18px',
                              border: row.selected ? '2px solid var(--primary)' : '2px solid var(--divider)',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: row.selected ? 'var(--primary)' : 'transparent',
                              transition: 'all 0.2s ease'
                            }}>
                              {row.selected && (
                                <i className="fas fa-check" style={{ 
                                  fontSize: '10px', 
                                  color: 'white',
                                  fontWeight: '900'
                                }}></i>
                              )}
                            </div>
                          </td>

                          {row.data.map((cell, cellIndex) => (
                            <td key={cellIndex} style={{
                              padding: '0.5rem 1rem',
                              fontSize: '0.875rem',
                              color: 'var(--text-primary)',
                              borderRight: cellIndex < row.data.length - 1 ? '1px solid var(--divider)' : 'none',
                              maxWidth: '200px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          background: 'var(--surface)',
          borderRadius: '12px',
          border: '2px dashed var(--divider)'
        }}>
          <i className="fas fa-file-csv" style={{ 
            fontSize: '3rem', 
            color: 'var(--divider)',
            marginBottom: '1rem',
            display: 'block'
          }}></i>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            ยังไม่มีไฟล์
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            คลิกปุ่ม "อัพโหลด CSV" เพื่อเริ่มต้น
          </p>
        </div>
      )}
    </div>
  );
}
