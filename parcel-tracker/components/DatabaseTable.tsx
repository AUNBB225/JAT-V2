'use client';

import { useState, useEffect, Fragment, useCallback, useMemo } from 'react';
import { Parcel } from '@/lib/supabase';

// ✅ Define interface properly
interface DatabaseTableProps {
  parcels: Parcel[];
  onUpdate: () => void;
  selectedIds?: Set<string>;
  onSelectOne?: (id: string) => void;
  onSelectAll?: () => void;
  sortConfig?: { key: keyof Parcel | null; direction: 'asc' | 'desc' | null };
  onSort?: (key: keyof Parcel) => void;
}

// ✅ Proper component definition with full destructuring
export default function DatabaseTable(props: DatabaseTableProps) {
  const {
    parcels,
    onUpdate,
    selectedIds = new Set(),
    onSelectOne,
    onSelectAll,
    sortConfig,
    onSort
  } = props;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Parcel>>({});
  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<string>>(new Set());
  const [draggedRow, setDraggedRow] = useState<string | null>(null);
  const [draggedOverRow, setDraggedOverRow] = useState<string | null>(null);
  const [localParcels, setLocalParcels] = useState<Parcel[]>(parcels);
  const [showAddModal, setShowAddModal] = useState(false);
  const [insertPosition, setInsertPosition] = useState<{ after: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newParcelData, setNewParcelData] = useState({
    sub_district: '',
    village: '',
    address: '',
    latitude: '',
    longitude: '',
  });
  
  const effectiveSelectedRows = onSelectOne ? selectedIds : internalSelectedRows;

  const { uniqueSubDistricts, uniqueVillages } = useMemo(() => {
    const subDistricts = [...new Set(parcels.map(p => p.sub_district))].sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase(), 'th')
    );
    
    let villages: string[] = [];
    if (newParcelData.sub_district) {
      villages = parcels
        .filter(p => p.sub_district === newParcelData.sub_district)
        .map(p => p.village);
      villages = [...new Set(villages)].sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });
    }
    
    return { uniqueSubDistricts: subDistricts, uniqueVillages: villages };
  }, [parcels, newParcelData.sub_district]);

  useEffect(() => {
    setLocalParcels(parcels);
  }, [parcels]);

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'custom-dialog-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      
      overlay.innerHTML = `
        <div class="custom-dialog">
          <div class="custom-dialog-header">
            <div class="custom-dialog-icon warning">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3 class="custom-dialog-title">ยืนยันการดำเนินการ</h3>
            <p class="custom-dialog-message">${message}</p>
          </div>
          <div class="custom-dialog-footer">
            <button class="custom-dialog-btn custom-dialog-btn-cancel" data-action="cancel">
              <i class="fas fa-times mr-2"></i>ยกเลิก
            </button>
            <button class="custom-dialog-btn custom-dialog-btn-confirm" data-action="confirm">
              <i class="fas fa-check mr-2"></i>ยืนยัน
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      setTimeout(() => {
        const cancelBtn = overlay.querySelector('[data-action="cancel"]') as HTMLButtonElement;
        cancelBtn?.focus();
      }, 100);

      const handleClick = (e: Event) => {
        const target = e.target as HTMLElement;
        const action = target.closest('[data-action]')?.getAttribute('data-action');
        if (action) {
          overlay.remove();
          resolve(action === 'confirm');
        }
      };

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });

      overlay.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', handleClick);
      });
    });
  }, []);

  const handleEdit = useCallback((parcel: Parcel) => {
    setEditingId(parcel.id);
    setEditData({ ...parcel });
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingId || !editData) return;

    try {
      const response = await fetch('/api/parcels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...editData }),
      });

      if (response.ok) {
        setLocalParcels(localParcels.map(p => 
          p.id === editingId ? { ...p, ...editData } : p
        ));
        showToast('บันทึกสำเร็จ', 'success');
        setEditingId(null);
        setEditData({});
        onUpdate();
      } else {
        const error = await response.json();
        showToast(error.message || 'เกิดข้อผิดพลาด', 'error');
      }
    } catch (error) {
      showToast('ไม่สามารถบันทึกได้', 'error');
    }
  }, [editingId, editData, localParcels, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditingId(null);
    setEditData({});
  }, []);

  const handleDelete = useCallback(async (parcel: Parcel) => {
    const confirmed = await showConfirm(`ต้องการลบ ${parcel.address} ใช่หรือไม่?`);
    if (!confirmed) return;

    try {
      const response = await fetch('/api/parcels', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: parcel.id }),
      });

      if (response.ok) {
        setLocalParcels(localParcels.filter(p => p.id !== parcel.id));
        showToast('ลบสำเร็จ', 'success');
        onUpdate();
      } else {
        showToast('เกิดข้อผิดพลาด', 'error');
      }
    } catch (error) {
      showToast('ไม่สามารถลบได้', 'error');
    }
  }, [localParcels, onUpdate, showConfirm]);

  const handleOpenAddModal = useCallback((afterId?: string) => {
    setNewParcelData({
      sub_district: '',
      village: '',
      address: '',
      latitude: '',
      longitude: '',
    });
    setInsertPosition(afterId ? { after: afterId } : null);
    setShowAddModal(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setShowAddModal(false);
    setInsertPosition(null);
  }, []);

  const handleGetCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('เบราว์เซอร์ไม่รองรับการใช้ตำแหน่ง', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNewParcelData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        showToast('ดึงพิกัดสำเร็จ', 'success');
      },
      () => showToast('ไม่สามารถดึงตำแหน่งได้', 'error'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const handleSubmitNewParcel = useCallback(async () => {
    if (!newParcelData.sub_district || !newParcelData.village || !newParcelData.address) {
      showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/parcels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newParcelData,
          latitude: newParcelData.latitude ? parseFloat(newParcelData.latitude) : null,
          longitude: newParcelData.longitude ? parseFloat(newParcelData.longitude) : null,
          parcel_count: 0,
          on_truck: false,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (insertPosition) {
          const index = localParcels.findIndex(p => p.id === insertPosition.after);
          const newParcels = [...localParcels];
          newParcels.splice(index + 1, 0, data);
          setLocalParcels(newParcels);
        } else {
          setLocalParcels([...localParcels, data]);
        }
        
        showToast('เพิ่มข้อมูลสำเร็จ', 'success');
        setShowAddModal(false);
        setInsertPosition(null);
        onUpdate();
      } else {
        showToast(data.error || 'เกิดข้อผิดพลาด', 'error');
      }
    } catch (error) {
      showToast('ไม่สามารถเพิ่มข้อมูลได้', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [newParcelData, localParcels, insertPosition, onUpdate]);

  // ✅ Proper type annotation for id parameter
  const toggleSelectRow = useCallback((id: string) => {
    if (onSelectOne) {
      onSelectOne(id);
    } else {
      setInternalSelectedRows(prev => {
        const newSelected = new Set(prev);
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
        return newSelected;
      });
    }
  }, [onSelectOne]);

  const handleSelectAllToggle = useCallback(() => {
    if (onSelectAll) {
      onSelectAll();
    } else {
      if (effectiveSelectedRows.size === localParcels.length) {
        setInternalSelectedRows(new Set());
      } else {
        setInternalSelectedRows(new Set(localParcels.map(p => p.id)));
      }
    }
  }, [onSelectAll, effectiveSelectedRows.size, localParcels]);

  const handleDeleteSelected = useCallback(async () => {
    if (effectiveSelectedRows.size === 0) {
      showToast('กรุณาเลือกแถวที่ต้องการลบ', 'error');
      return;
    }

    const confirmed = await showConfirm(`ต้องการลบ ${effectiveSelectedRows.size} แถวที่เลือกใช่หรือไม่?`);
    if (!confirmed) return;

    const selectedParcels = localParcels.filter(p => effectiveSelectedRows.has(p.id));
    
    try {
      await Promise.all(
        selectedParcels.map(parcel =>
          fetch('/api/parcels', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: parcel.id }),
          })
        )
      );

      setLocalParcels(localParcels.filter(p => !effectiveSelectedRows.has(p.id)));
      showToast(`ลบ ${effectiveSelectedRows.size} แถวสำเร็จ`, 'success');
      setInternalSelectedRows(new Set());
      onUpdate();
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการลบ', 'error');
    }
  }, [effectiveSelectedRows, localParcels, onUpdate, showConfirm]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedRow(id);
    e.dataTransfer.effectAllowed = 'move';
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.4';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedRow !== id) {
      setDraggedOverRow(id);
    }
  }, [draggedRow]);

  const handleDragLeave = useCallback(() => {
    setDraggedOverRow(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    
    if (!draggedRow || draggedRow === targetId) {
      setDraggedRow(null);
      setDraggedOverRow(null);
      return;
    }

    const draggedIndex = localParcels.findIndex(p => p.id === draggedRow);
    const targetIndex = localParcels.findIndex(p => p.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newParcels = [...localParcels];
    const [draggedItem] = newParcels.splice(draggedIndex, 1);
    newParcels.splice(targetIndex, 0, draggedItem);

    setLocalParcels(newParcels);

    const reorderedItems = newParcels.map((parcel, index) => ({
      id: parcel.id,
      display_order: index
    }));

    try {
      const response = await fetch('/api/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: reorderedItems }),
      });

      if (response.ok) {
        showToast('เรียงลำดับสำเร็จ', 'success');
        onUpdate();
      } else {
        throw new Error('Failed to save order');
      }
    } catch (error) {
      showToast('ไม่สามารถบันทึกลำดับได้', 'error');
      setLocalParcels(parcels);
    }

    setDraggedRow(null);
    setDraggedOverRow(null);
  }, [draggedRow, localParcels, parcels, onUpdate]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    setDraggedRow(null);
    setDraggedOverRow(null);
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }, []);

  const getSortIcon = useCallback((key: keyof Parcel) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <i className="fas fa-sort text-gray-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"></i>;
    }
    if (sortConfig.direction === 'asc') {
      return <i className="fas fa-sort-up text-primary ml-2"></i>;
    }
    return <i className="fas fa-sort-down text-primary ml-2"></i>;
  }, [sortConfig]);

  if (localParcels.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <i className="fas fa-inbox"></i>
        </div>
        <h3 className="empty-title">ไม่มีข้อมูล</h3>
        <p className="empty-description">ยังไม่มีรายการพัสดุในระบบ</p>
        <button onClick={() => handleOpenAddModal()} className="btn-primary mt-6">
          <i className="fas fa-plus mr-2"></i> เพิ่มรายการแรก
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="modern-table-container">
        <div className="modern-toolbar">
          <div className="toolbar-left">
            <button onClick={() => handleOpenAddModal()} className="btn-primary">
              <i className="fas fa-plus mr-2"></i> เพิ่มแถวใหม่
            </button>
            {effectiveSelectedRows.size > 0 && (
              <>
                <div className="toolbar-divider"></div>
                <span className="toolbar-badge">
                  {effectiveSelectedRows.size} รายการ
                </span>
                <button onClick={handleDeleteSelected} className="btn-danger">
                  <i className="fas fa-trash mr-2"></i> ลบที่เลือก
                </button>
                <button 
                  onClick={() => onSelectOne ? onSelectAll?.() : setInternalSelectedRows(new Set())} 
                  className="btn-secondary"
                >
                  <i className="fas fa-times mr-2"></i> ยกเลิก
                </button>
              </>
            )}
          </div>
          <div className="toolbar-right">
            <span className="toolbar-count">
              <i className="fas fa-table mr-2"></i>
              ทั้งหมด {localParcels.length} รายการ
            </span>
          </div>
        </div>

        <div className="modern-table-wrapper">
          <table className="modern-table">
            <thead>
              <tr>
                <th className="th-checkbox">
                  <div className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      className="modern-checkbox"
                      onChange={handleSelectAllToggle}
                      checked={effectiveSelectedRows.size === localParcels.length && localParcels.length > 0}
                    />
                  </div>
                </th>
                <th className="th-drag">
                  <i className="fas fa-grip-vertical text-gray-400"></i>
                </th>
                <th 
                  className={`th-sortable group ${onSort ? 'cursor-pointer' : ''}`}
                  onClick={() => onSort?.('sub_district')}
                >
                  <div className="th-content">
                    <span>ตำบล</span>
                    {onSort && getSortIcon('sub_district')}
                  </div>
                </th>
                <th 
                  className={`th-sortable group ${onSort ? 'cursor-pointer' : ''}`}
                  onClick={() => onSort?.('village')}
                >
                  <div className="th-content">
                    <span>หมู่</span>
                    {onSort && getSortIcon('village')}
                  </div>
                </th>
                <th 
                  className={`th-sortable group ${onSort ? 'cursor-pointer' : ''}`}
                  onClick={() => onSort?.('address')}
                >
                  <div className="th-content">
                    <span>ที่อยู่</span>
                    {onSort && getSortIcon('address')}
                  </div>
                </th>
                <th className="th-center th-small">จำนวน</th>
                <th className="th-center th-small">สถานะ</th>
                <th className="th-center">GPS</th>
                <th className="th-actions">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {localParcels.map((parcel) => (
                <Fragment key={parcel.id}>
                  <tr
                    className={`modern-tr ${effectiveSelectedRows.has(parcel.id) ? 'selected' : ''} ${draggedRow === parcel.id ? 'dragging' : ''} ${draggedOverRow === parcel.id ? 'drag-over' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, parcel.id)}
                    onDragOver={(e) => handleDragOver(e, parcel.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, parcel.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <td className="td-checkbox">
                      <div className="checkbox-wrapper">
                        <input
                          type="checkbox"
                          className="modern-checkbox"
                          checked={effectiveSelectedRows.has(parcel.id)}
                          onChange={() => toggleSelectRow(parcel.id)}
                        />
                      </div>
                    </td>

                    <td className="td-drag">
                      <button className="drag-handle" title="ลากเพื่อเรียงลำดับ">
                        <i className="fas fa-grip-vertical"></i>
                      </button>
                    </td>

                    <td className="td-data">
                      {editingId === parcel.id ? (
                        <input
                          type="text"
                          className="modern-input"
                          value={editData.sub_district || ''}
                          onChange={(e) => setEditData({ ...editData, sub_district: e.target.value })}
                        />
                      ) : (
                        <span className="td-text">{parcel.sub_district}</span>
                      )}
                    </td>

                    <td className="td-data">
                      {editingId === parcel.id ? (
                        <input
                          type="text"
                          className="modern-input"
                          value={editData.village || ''}
                          onChange={(e) => setEditData({ ...editData, village: e.target.value })}
                        />
                      ) : (
                        <span className="td-text">{parcel.village}</span>
                      )}
                    </td>

                    <td className="td-data">
                      {editingId === parcel.id ? (
                        <input
                          type="text"
                          className="modern-input"
                          value={editData.address || ''}
                          onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                        />
                      ) : (
                        <span className="td-text font-mono font-semibold">{parcel.address}</span>
                      )}
                    </td>

                    <td className="td-center">
                      {editingId === parcel.id ? (
                        <input
                          type="number"
                          className="modern-input text-center"
                          value={editData.parcel_count || 0}
                          onChange={(e) => setEditData({ ...editData, parcel_count: parseInt(e.target.value) || 0 })}
                          min="0"
                        />
                      ) : (
                        <span className="td-badge badge-count">{parcel.parcel_count}</span>
                      )}
                    </td>

                    <td className="td-center">
                      {editingId === parcel.id ? (
                        <div className="checkbox-wrapper">
                          <input
                            type="checkbox"
                            className="modern-checkbox"
                            checked={editData.on_truck || false}
                            onChange={(e) => setEditData({ ...editData, on_truck: e.target.checked })}
                          />
                        </div>
                      ) : (
                        parcel.on_truck ? (
                          <span className="td-badge badge-success">
                            <i className="fas fa-truck-fast mr-1"></i> บนรถ
                          </span>
                        ) : (
                          <span className="td-badge badge-gray">
                            <i className="fas fa-clock mr-1"></i> รอ
                          </span>
                        )
                      )}
                    </td>

                    <td className="td-center">
                      {parcel.latitude && parcel.longitude ? (
                        <a
                          href={`https://www.google.com/maps?q=${parcel.latitude},${parcel.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gps-link"
                          title="ดูใน Google Maps"
                        >
                          <i className="fas fa-map-marker-alt"></i>
                        </a>
                      ) : (
                        <span className="gps-empty">
                          <i className="fas fa-map-marker-slash"></i>
                        </span>
                      )}
                    </td>

                    <td className="td-actions">
                      {editingId === parcel.id ? (
                        <div className="action-group">
                          <button onClick={handleSave} className="action-btn btn-save" title="บันทึก">
                            <i className="fas fa-check"></i>
                          </button>
                          <button onClick={handleCancel} className="action-btn btn-cancel" title="ยกเลิก">
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="action-group">
                          <button 
                            onClick={() => handleOpenAddModal(parcel.id)} 
                            className="action-btn btn-add" 
                            title="แทรกแถวด้านล่าง"
                          >
                            <i className="fas fa-plus"></i>
                          </button>
                          <button onClick={() => handleEdit(parcel)} className="action-btn btn-edit" title="แก้ไข">
                            <i className="fas fa-edit"></i>
                          </button>
                          <button onClick={() => handleDelete(parcel)} className="action-btn btn-delete" title="ลบ">
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="modern-modal-overlay" onClick={(e) => e.target === e.currentTarget && handleCloseAddModal()}>
          <div className="modern-modal">
            <div className="modal-header">
              <div className="modal-icon">
                <i className="fas fa-plus-circle"></i>
              </div>
              <div>
                <h2 className="modal-title">เพิ่มที่อยู่ใหม่</h2>
                {insertPosition && (
                  <p className="modal-subtitle">
                    <i className="fas fa-arrow-down mr-2"></i>
                    แทรกด้านล่างแถวที่เลือก
                  </p>
                )}
              </div>
              <button onClick={handleCloseAddModal} className="modal-close">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="sub-district-input">
                    <i className="fas fa-city mr-2"></i>ตำบล
                  </label>
                  <input
                    id="sub-district-input"
                    type="text"
                    className="modern-input"
                    list="subdistrict-list"
                    placeholder="พิมพ์หรือเลือกตำบล"
                    value={newParcelData.sub_district}
                    onChange={(e) => setNewParcelData({ ...newParcelData, sub_district: e.target.value, village: '' })}
                  />
                  <datalist id="subdistrict-list">
                    {uniqueSubDistricts.map(sub => (
                      <option key={sub} value={sub} />
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="village-input">
                    <i className="fas fa-house-user mr-2"></i>หมู่
                  </label>
                  <input
                    id="village-input"
                    type="text"
                    className="modern-input"
                    list="village-list"
                    placeholder="พิมพ์หรือเลือกหมู่"
                    value={newParcelData.village}
                    onChange={(e) => setNewParcelData({ ...newParcelData, village: e.target.value })}
                    disabled={!newParcelData.sub_district}
                  />
                  <datalist id="village-list">
                    {uniqueVillages.map(village => (
                      <option key={village} value={village} />
                    ))}
                  </datalist>
                </div>

                <div className="form-group form-group-full">
                  <label className="form-label" htmlFor="address-input">
                    <i className="fas fa-map-pin mr-2"></i>ที่อยู่
                  </label>
                  <input
                    id="address-input"
                    type="text"
                    className="modern-input"
                    placeholder="เช่น 50/4"
                    value={newParcelData.address}
                    onChange={(e) => setNewParcelData({ ...newParcelData, address: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="latitude-input">
                    <i className="fas fa-location-dot mr-2"></i>Latitude
                  </label>
                  <input
                    id="latitude-input"
                    type="text"
                    className="modern-input"
                    placeholder="13.756345"
                    value={newParcelData.latitude}
                    onChange={(e) => setNewParcelData({ ...newParcelData, latitude: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="longitude-input">
                    <i className="fas fa-location-dot mr-2"></i>Longitude
                  </label>
                  <input
                    id="longitude-input"
                    type="text"
                    className="modern-input"
                    placeholder="100.501800"
                    value={newParcelData.longitude}
                    onChange={(e) => setNewParcelData({ ...newParcelData, longitude: e.target.value })}
                  />
                </div>
              </div>

              <button onClick={handleGetCurrentLocation} className="btn-secondary w-full mt-4">
                <i className="fas fa-location-crosshairs mr-2"></i>
                ใช้ตำแหน่งปัจจุบัน
              </button>
            </div>

            <div className="modal-footer">
              <button onClick={handleCloseAddModal} className="btn-secondary" disabled={isSubmitting}>
                <i className="fas fa-times mr-2"></i>ยกเลิก
              </button>
              <button onClick={handleSubmitNewParcel} className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-2"></i>บันทึก
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
