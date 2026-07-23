import { useState, useMemo } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, UserPlus, Briefcase, Building,
  Download, CheckCircle2, ChevronRight, X, Sparkles
} from 'lucide-react';
import { Employee } from '../types';
import { calculatePayslip, formatNaira } from '../utils/taxEngine';

const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'emp-1', name: 'Oluwaseun Adebayo', role: 'Senior Engineer', grossMonthlySalary: 850000, optInPension: true, optInNHF: true, optInNHIS: true },
  { id: 'emp-2', name: 'Chioma Nnamdi', role: 'Product Manager', grossMonthlySalary: 620000, optInPension: true, optInNHF: true, optInNHIS: false },
  { id: 'emp-3', name: 'Musa Ibrahim', role: 'Sales Executive', grossMonthlySalary: 350000, optInPension: true, optInNHF: false, optInNHIS: false },
];

// PAYE calculation now uses shared taxEngine — see src/utils/taxEngine.ts

export default function PayrollManager() {
  const [employees, setEmployees] = usePersistedState<Employee[]>('employees', INITIAL_EMPLOYEES);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // New Employee Form
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newGross, setNewGross] = useState('');
  const [newOptPension, setNewOptPension] = useState(true);
  const [newOptNHF, setNewOptNHF] = useState(false);
  const [newOptNHIS, setNewOptNHIS] = useState(false);

  const payslips = useMemo(() => {
    return employees.map(emp => calculatePayslip(emp));
  }, [employees]);

  const totalGross = payslips.reduce((sum, p) => sum + p.gross, 0);
  const totalPAYE = payslips.reduce((sum, p) => sum + p.paye, 0);
  const totalPension = payslips.reduce((sum, p) => sum + p.pension, 0);
  const totalNet = payslips.reduce((sum, p) => sum + p.netPay, 0);

  const handleAddEmployee = () => {
    if (!newName.trim() || !newGross) return;

    const newEmp: Employee = {
      id: 'emp-' + Date.now(),
      name: newName,
      role: newRole || 'Employee',
      grossMonthlySalary: parseFloat(newGross) || 0,
      optInPension: newOptPension,
      optInNHF: newOptNHF,
      optInNHIS: newOptNHIS
    };

    setEmployees(prev => [...prev, newEmp]);
    setIsAddModalOpen(false);
    
    // Reset form
    setNewName('');
    setNewRole('');
    setNewGross('');
    setNewOptPension(true);
    setNewOptNHF(false);
    setNewOptNHIS(false);
  };

  const getEmployeePayslip = (id: string) => payslips.find(p => p.employeeId === id);

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-left pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-primary-container tracking-tight">SME Payroll & PAYE</h2>
          <p className="text-sm text-on-surface-variant mt-1">Manage employees, auto-calculate PAYE, and generate statutory remittance reports.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="h-11 px-5 bg-[#013220] text-white text-xs font-bold rounded-xl hover:opacity-95 active:scale-[0.98] transition-all flex items-center space-x-2 shadow-sm cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Aggregate Remittance Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total Gross</p>
            <Users className="w-4 h-4 text-primary-container/60" />
          </div>
          <p className="text-2xl font-black text-primary-container">{formatNaira(totalGross)}</p>
          <p className="text-[10px] text-on-surface-variant mt-1">{employees.length} employees</p>
        </div>
        
        <div className="bg-[#013220] rounded-xl p-5 shadow-xs text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider">PAYE Remittance</p>
            <Building className="w-4 h-4 text-emerald-200" />
          </div>
          <p className="text-2xl font-black text-white">{formatNaira(totalPAYE)}</p>
          <p className="text-[10px] text-emerald-100 mt-1">Due to State Inland Revenue</p>
        </div>

        <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Pension (8%)</p>
            <Briefcase className="w-4 h-4 text-on-surface-variant/60" />
          </div>
          <p className="text-2xl font-black text-primary-container">{formatNaira(totalPension)}</p>
          <p className="text-[10px] text-on-surface-variant mt-1">To Employee PFAs</p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Total Net Pay</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700">{formatNaira(totalNet)}</p>
          <p className="text-[10px] text-emerald-600 mt-1">Amount to disburse</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="flex-1 sm:flex-none h-11 px-6 bg-surface-container border border-outline-variant text-primary-container text-xs font-bold rounded-xl flex items-center justify-center space-x-2 hover:bg-surface-container-high transition-colors cursor-pointer">
          <Download className="w-4 h-4" />
          <span>Export Payroll CSV</span>
        </button>
        <button className="flex-1 sm:flex-none h-11 px-6 bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 hover:opacity-95 transition-all cursor-pointer shadow-sm">
          <Sparkles className="w-4 h-4" />
          <span>Generate Remittance Schedule</span>
        </button>
      </div>

      {/* Employee Roster Table */}
      <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-outline-variant/40 bg-surface-container-low flex justify-between items-center">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Employee Roster</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-outline-variant/40">
                <th className="px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Gross Pay</th>
                <th className="px-6 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Pension</th>
                <th className="px-6 py-3 text-[10px] font-bold text-primary-container uppercase tracking-wider text-right">PAYE Due</th>
                <th className="px-6 py-3 text-[10px] font-bold text-emerald-700 uppercase tracking-wider text-right">Net Pay</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {employees.map(emp => {
                const slip = getEmployeePayslip(emp.id);
                if (!slip) return null;
                return (
                  <motion.tr 
                    key={emp.id}
                    className="hover:bg-surface-container-low/50 transition-colors cursor-pointer group"
                    onClick={() => setSelectedEmployee(emp)}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-on-surface">{emp.name}</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">{emp.role}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-semibold text-on-surface-variant">{formatNaira(slip.gross)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-xs text-on-surface-variant">{formatNaira(slip.pension)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-bold text-primary-container">{formatNaira(slip.paye)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-emerald-700">{formatNaira(slip.netPay)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="w-4 h-4 text-on-surface-variant/40 inline-block group-hover:text-primary-container transition-colors" />
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setIsAddModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="border-b border-outline-variant/40 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-black text-primary-container">Add Employee</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Chidi Okafor"
                    className="w-full h-11 px-4 bg-background border border-outline rounded-xl text-sm font-semibold text-on-surface focus:outline-none focus:border-primary-container"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Job Role</label>
                    <input
                      type="text"
                      value={newRole}
                      onChange={e => setNewRole(e.target.value)}
                      placeholder="e.g. Designer"
                      className="w-full h-11 px-4 bg-background border border-outline rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary-container"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Gross Monthly Salary</label>
                    <input
                      type="number"
                      value={newGross}
                      onChange={e => setNewGross(e.target.value)}
                      placeholder="₦0.00"
                      className="w-full h-11 px-4 bg-background border border-outline rounded-xl text-sm font-semibold text-on-surface focus:outline-none focus:border-primary-container"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-outline-variant/40">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">Statutory Opt-ins</p>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input type="checkbox" checked={newOptPension} onChange={e => setNewOptPension(e.target.checked)} className="w-4 h-4 rounded text-primary-container focus:ring-primary-container border-gray-300" />
                      <span className="text-sm text-on-surface-variant">Deduct Pension (8% Employee)</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input type="checkbox" checked={newOptNHF} onChange={e => setNewOptNHF(e.target.checked)} className="w-4 h-4 rounded text-primary-container focus:ring-primary-container border-gray-300" />
                      <span className="text-sm text-on-surface-variant">Deduct NHF (2.5% Housing Fund)</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input type="checkbox" checked={newOptNHIS} onChange={e => setNewOptNHIS(e.target.checked)} className="w-4 h-4 rounded text-primary-container focus:ring-primary-container border-gray-300" />
                      <span className="text-sm text-on-surface-variant">Deduct NHIS (Health Insurance)</span>
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleAddEmployee}
                  disabled={!newName.trim() || !newGross}
                  className="w-full h-12 mt-6 bg-[#013220] text-white text-sm font-bold rounded-xl flex items-center justify-center hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save Employee
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payslip Slide-over */}
      <AnimatePresence>
        {selectedEmployee && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex justify-end"
            onClick={() => setSelectedEmployee(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-surface-container-low border-b border-outline-variant/40 px-6 py-6 flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Payslip Details</p>
                  <h3 className="text-xl font-black text-primary-container mt-1">{selectedEmployee.name}</h3>
                  <p className="text-xs font-semibold text-on-surface-variant">{selectedEmployee.role}</p>
                </div>
                <button onClick={() => setSelectedEmployee(null)} className="p-2 rounded-lg bg-white border border-outline-variant hover:bg-gray-50 transition-colors cursor-pointer">
                  <X className="w-4 h-4 text-on-surface-variant" />
                </button>
              </div>

              {(() => {
                const slip = getEmployeePayslip(selectedEmployee.id);
                if (!slip) return null;
                return (
                  <div className="p-6 flex-grow flex flex-col space-y-6">
                    {/* Gross */}
                    <div className="flex justify-between items-end border-b border-outline-variant/30 pb-3">
                      <span className="text-sm font-bold text-on-surface">Gross Monthly Earnings</span>
                      <span className="text-lg font-black text-on-surface">{formatNaira(slip.gross)}</span>
                    </div>

                    {/* Statutory Deductions */}
                    <div>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">Statutory Deductions (Pre-Tax)</p>
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-on-surface-variant">Pension (8%)</span>
                          <span className="text-red-600 font-semibold">- {formatNaira(slip.pension)}</span>
                        </div>
                        {slip.nhf > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-on-surface-variant">NHF (2.5%)</span>
                            <span className="text-red-600 font-semibold">- {formatNaira(slip.nhf)}</span>
                          </div>
                        )}
                        {slip.nhis > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-on-surface-variant">NHIS (Flat)</span>
                            <span className="text-red-600 font-semibold">- {formatNaira(slip.nhis)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tax Computation */}
                    <div>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">Tax Computation (Monthly)</p>
                      <div className="space-y-3 bg-surface-container-low p-4 rounded-xl border border-outline-variant/50">
                        <div className="flex justify-between text-xs">
                          <span className="text-on-surface-variant">Consolidated Relief (CRA)</span>
                          <span className="text-emerald-700 font-semibold">Exempt: {formatNaira(slip.cra)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-on-surface-variant">Chargeable Income</span>
                          <span className="text-on-surface font-semibold">{formatNaira(slip.taxableIncome)}</span>
                        </div>
                        <div className="border-t border-outline-variant pt-2 flex justify-between">
                          <span className="text-sm font-bold text-primary-container">PAYE Due</span>
                          <span className="text-sm font-black text-red-600">- {formatNaira(slip.paye)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-grow"></div>

                    {/* Net Pay */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex justify-between items-center">
                      <span className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Net Take-Home</span>
                      <span className="text-2xl font-black text-emerald-700">{formatNaira(slip.netPay)}</span>
                    </div>

                    <button className="w-full h-11 bg-surface-container border border-outline-variant text-on-surface-variant text-xs font-bold rounded-xl flex items-center justify-center space-x-2 hover:bg-surface-container-high transition-colors cursor-pointer mt-4">
                      <Download className="w-4 h-4" />
                      <span>Download Payslip PDF</span>
                    </button>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
