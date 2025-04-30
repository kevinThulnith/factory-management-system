from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.db import models, transaction
from main.models import phone_validator
from django.utils.timezone import now
from django.core.cache import cache
from django.utils import timezone
from django.db.models import Sum
from django.db import connection
from datetime import timedelta
import threading
import logging
import time

User = get_user_model()
_operator_checker_thread = None
logger = logging.getLogger(__name__)

# TODO: Create core models


class Department(models.Model):
    """
    Department Model

    - One-to-Many with Employees (a department has many employees) ☑️
    - One-to-Many with Workshop (a department has many workshop areas) ☑️
    - One-to-One with Employee as department head (optional) ☑️
    """

    name = models.CharField(_("name"), max_length=255, unique=True)
    description = models.TextField(_("description"), blank=True, null=True)
    location = models.CharField(_("location"), max_length=255, blank=True, null=True)
    supervisor = models.ForeignKey(
        "main.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="supervised_departments",
    )
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        old_supervisor_id = None

        if self.pk:
            old_supervisor_id = (
                Department.objects.filter(pk=self.pk)
                .values_list("supervisor_id", flat=True)
                .first()
            )

        super().save(*args, **kwargs)

        # !Skip if no change
        if self.supervisor_id == old_supervisor_id:
            return

        # !Update old supervisor
        if old_supervisor_id:
            other_depts = Department.objects.filter(
                supervisor_id=old_supervisor_id
            ).exclude(pk=self.pk)
            if not other_depts.exists():
                User.objects.filter(pk=old_supervisor_id).update(
                    role=User.Role.OPERATOR, department=None
                )

        # !Update new supervisor
        if self.supervisor:
            self.supervisor.role = User.Role.SUPERVISOR
            self.supervisor.department = self
            self.supervisor.save(update_fields=["role", "department"])


class Workshop(models.Model):
    """
    Workshop Model

    - Many-to-One with Department (a workshop belongs to one department) ☑️
    - One-to-Many with ProductionLines (a workshop has many production lines) ☑️
    - One-to-Many with Machines (a workshop has many machines) ☑️
    - One-to-One with Employee as supervisor (optional) ☑️
    """

    class OperationalStatus(models.TextChoices):
        ACTIVE = "ACTIVE", _("Active")
        MAINTENANCE = "MAINTENANCE", _("Under Maintenance")
        INACTIVE = "INACTIVE", _("Inactive")

    name = models.CharField(_("name"), max_length=100, unique=True)
    description = models.TextField(_("description"), blank=True, null=True)
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name="workshops"
    )
    manager = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_workshops",
    )
    operational_status = models.CharField(
        max_length=20,
        choices=OperationalStatus.choices,
        default=OperationalStatus.ACTIVE,
    )
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.department})"

    def save(self, *args, **kwargs):
        old_manager_id = None

        if self.pk:
            old_manager_id = (
                Workshop.objects.filter(pk=self.pk)
                .values_list("manager_id", flat=True)
                .first()
            )

        super().save(*args, **kwargs)

        # If manager hasn't changed, exit early
        if self.manager_id == old_manager_id:
            return

        # Handle old manager: set to OPERATOR if no other workshops are managed
        if old_manager_id:
            other_workshops = Workshop.objects.filter(
                manager_id=old_manager_id
            ).exclude(pk=self.pk)
            if not other_workshops.exists():
                User.objects.filter(pk=old_manager_id).update(
                    role=User.Role.OPERATOR, department=None
                )

        # Update new manager’s role and department
        if self.manager:
            self.manager.role = User.Role.MANAGER
            self.manager.department = self.department
            self.manager.save(update_fields=["role", "department"])


class Machine(models.Model):
    """
    Machine Model

    - Many-to-One with Workshop (a machine belongs to one workshop) ☑️
    """

    class Status(models.TextChoices):
        OPERATIONAL = "OPERATIONAL", _("Operational")
        IDLE = "IDLE", _("Idle")
        MAINTENANCE = "MAINTENANCE", _("Under Maintenance")
        BROKEN = "BROKEN", _("Broken Down")

    name = models.CharField(max_length=100)
    model_number = models.CharField(max_length=100, blank=True)
    workshop = models.ForeignKey(
        Workshop, on_delete=models.PROTECT, related_name="machines"
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.IDLE
    )
    purchase_date = models.DateField(null=True, blank=True)
    last_maintenance_date = models.DateField(null=True, blank=True)
    next_maintenance_date = models.DateField(null=True, blank=True)
    operator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    operator_assigned_at = models.DateTimeField(null=True, blank=True)
    operator_auto_remove_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["workshop", "name"]

    def __str__(self):
        return f"{self.name} ({self.workshop.name})"

    def assign_operator(self, operator):
        # TODO: Assign operator to machine for 12 hours
        now = timezone.now()
        self.operator = operator
        self.operator_assigned_at = now
        self.operator_auto_remove_at = now + timedelta(hours=8)
        self.save(
            update_fields=[
                "operator",
                "operator_assigned_at",
                "operator_auto_remove_at",
            ]
        )

        # !Make sure to clear the cache for this machine
        start_operator_checker_thread()

        logger.info(
            f"Operator {operator} assigned to machine {self.id} until {self.operator_auto_remove_at}"
        )

    def clear_operator(self):
        # TODO: Clear the operator assignment
        self.operator = None
        self.operator_assigned_at = None
        self.operator_auto_remove_at = None
        self.save(
            update_fields=[
                "operator",
                "operator_assigned_at",
                "operator_auto_remove_at",
            ]
        )

        # !Make sure to clear the cache for this machine
        logger.info(f"Cleared operator from machine {self.id}")

    def save(self, *args, **kwargs):
        operator_changed = False  # !Track if operator assignment has changed
        if self.pk:
            try:
                old_instance = Machine.objects.get(pk=self.pk)
                operator_changed = (
                    self.operator_id != old_instance.operator_id
                    and self.operator is not None
                )
            except Machine.DoesNotExist:
                pass

        super().save(*args, **kwargs)

        if operator_changed:
            self.assign_operator(self.operator)


class OperatorCheckerThread(threading.Thread):
    "Background thread to check and clear expired operator assignments"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.daemon = True
        self.running = True
        self.name = "OperatorCheckerThread"

    def run(self):
        logger.info("Starting operator checker thread")
        while self.running:
            try:
                self._check_expired_operators()
            except Exception as e:
                logger.error(f"Error checking expired operators: {e}")

            # Sleep for 5 minutes before checking again
            time.sleep(300)  # 5 minutes

    def _check_expired_operators(self):
        # TODO: Close any stale connections before accessing the database
        connection.close()
        now = timezone.now()
        expired_machines = Machine.objects.filter(
            operator__isnull=False,
            operator_auto_remove_at__isnull=False,
            operator_auto_remove_at__lte=now,
        )

        count = expired_machines.count()
        if count > 0:
            logger.info(f"Found {count} machines with expired operator assignments")

        for machine in expired_machines:
            logger.info(f"Clearing expired operator from machine {machine.id}")


def start_operator_checker_thread():
    # TODO:  Start the operator checker thread if it's not already running"""
    global _operator_checker_thread

    if _operator_checker_thread is None or not _operator_checker_thread.is_alive():
        _operator_checker_thread = OperatorCheckerThread()
        _operator_checker_thread.start()
        logger.info("Started operator checker thread")


# TODO: Create Inventory | Material tables


class Material(models.Model):
    """
    Material Model

    - One-to-Many with Order items (a material can be in many Orders) ☑️
    """

    name = models.CharField(_("name"), max_length=255, unique=True)
    description = models.TextField(_("description"), blank=True, null=True)
    unit_of_measurement = models.CharField(
        _("unit of measurement"), max_length=50, blank=True, null=True
    )
    quantity = models.DecimalField(
        _("quantity"), max_digits=10, decimal_places=2, default=0.00
    )
    reorder_level = models.DecimalField(
        _("reorder level"), max_digits=10, decimal_places=2, default=0.00
    )
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} -> {self.quantity} {self.unit_of_measurement}"


class Supplier(models.Model):
    """
    Supplier Model

    - One-to-Many with orders (a supplier can have many purchases) ☑️
    """

    name = models.CharField(_("name"), max_length=150)
    address = models.TextField(_("address"), blank=True)
    email = models.EmailField(_("email"), blank=True, unique=True)
    phone = models.CharField(
        _("phone no"),
        max_length=30,
        blank=True,
        unique=True,
        validators=[phone_validator],
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Order(models.Model):
    """
    Order Model

    - One-to-Many with Suppliers (an order can have one supplier) ☑️
    - One-to-Many with Employee (an order can have one employee) ☑️
    """

    class OrderStatus(models.TextChoices):
        DRAFT = "DRAFT", _("Draft")
        ORDERED = "ORDERED", _("Ordered")
        RECEIVED = "RECEIVED", _("Received Complete")
        CANCELLED = "CANCELLED", _("Cancelled")

    order_date = models.DateField(_("order date"), auto_now_add=True)
    supplier = models.ForeignKey(
        Supplier, on_delete=models.CASCADE, related_name="orders"
    )
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="created_orders"
    )
    status = models.CharField(
        max_length=20,
        choices=OrderStatus.choices,
        default=OrderStatus.DRAFT,
        db_index=True,
    )
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)
    total = models.DecimalField(
        _("total"), max_digits=10, decimal_places=2, default=0.00
    )

    class Meta:
        ordering = ["order_date"]
        indexes = [
            models.Index(
                fields=["supplier", "status"]
            ),  # Composite index for common queries
        ]

    def __str__(self):
        return f"Order #{self.id} from {self.supplier.name}"

    def save(self, *args, **kwargs):
        is_receiving = False

        if self.pk:
            old_order = Order.objects.get(pk=self.pk)
            if (
                old_order.status != self.OrderStatus.RECEIVED
                and self.status == self.OrderStatus.RECEIVED
            ):
                is_receiving = True

        super().save(*args, **kwargs)

        if is_receiving:
            self._update_material_stocks()

    @transaction.atomic
    def _update_material_stocks(self):
        """
        Update material quantities when order is marked as received.
        """
        for order_material in self.order_materials.all():
            material = order_material.material
            material.quantity += order_material.quantity
            material.save(update_fields=["quantity"])


class OrderMaterial(models.Model):
    """
    Order Material Model

    - Many-to-One with Orders (an order can have many materials) ☑️
    - Many-to-One with Materials (a material can be in many orders) ☑️
    """

    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="order_materials"
    )
    material = models.ForeignKey(
        Material, on_delete=models.CASCADE, related_name="order_materials"
    )
    quantity = models.DecimalField(_("quantity"), max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(_("unit price"), max_digits=10, decimal_places=2)
    total_price = models.DecimalField(
        _("total price"), max_digits=10, decimal_places=2, default=0.00
    )

    class Meta:
        ordering = ["order"]
        unique_together = ["order", "material"]
        indexes = [
            models.Index(fields=["order"]),
            models.Index(fields=["material"]),
        ]

    def __str__(self):
        return f"{self.material.name} - {self.unit_price} - {self.quantity} -> {self.total_price}"

    def save(self, *args, **kwargs):
        self.total_price = self.unit_price * self.quantity
        super().save(*args, **kwargs)  # Save before updating totals
        self.update_order_total()

    def update_order_total(self):
        "Recalculate the order total based on all materials."
        total = (
            OrderMaterial.objects.filter(order=self.order).aggregate(
                total=Sum("total_price")
            )["total"]
            or 0.00
        )
        Order.objects.filter(pk=self.order.pk).update(total=total)


# TODO: Create production line tables


class ProductionLine(models.Model):
    """
    Production Line Model

    - Many-to-One with WorkshopArea (a production line belongs to one workshop) ☑️
    - One-to-Many with ProductionSchedules (a production line has many schedules) ☑️
    - Many-to-Many with Employees through LaborAllocation (a production line can have many employees) ☑️
    """

    class OperationalStatus(models.TextChoices):
        ACTIVE = "ACTIVE", _("Active")
        INACTIVE = "INACTIVE", _("Inactive")
        MAINTENANCE = "MAINTENANCE", _("Under Maintenance")

    name = models.CharField(_("name"), max_length=100, unique=True)
    description = models.TextField(_("description"), blank=True, null=True)
    production_capacity = models.DecimalField(
        _("production capacity"), max_digits=10, decimal_places=2, default=0.00
    )
    operational_status = models.CharField(
        max_length=20,
        choices=OperationalStatus.choices,
        default=OperationalStatus.ACTIVE,
        verbose_name=_("operational status"),
    )
    machines = models.ManyToManyField(
        Machine, blank=True, related_name="production_lines", verbose_name=_("machines")
    )
    workshop = models.ForeignKey(
        Workshop,
        on_delete=models.CASCADE,
        related_name="production_lines",
        verbose_name=_("workshop"),
    )
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["operational_status"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.workshop.name})"

    def clean(self):
        if self.production_capacity < 0:
            raise ValidationError(_("Production capacity must be non-negative."))

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class ManufacturingProcess(models.Model):
    """
    Manufacturing Process Model

    Relationships:
    - Many-to-Many with Products through ProductProcess
    """

    name = models.CharField(max_length=100)
    description = models.TextField()
    standard_time = models.DurationField()
    quality_parameters = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["name"])]

    def __str__(self):
        return self.name


class ProductionSchedule(models.Model):
    """
    Production Schedule Model

    Relationships:
    - Many-to-One with ProductionLine (a schedule belongs to one production line)
    - Many-to-One with Product (a schedule is for one product)
    - Many-to-One with Employee (a schedule is created by one employee)
    """

    class ScheduleStatus(models.TextChoices):
        SCHEDULED = "SCHEDULED", _("Scheduled")
        IN_PROGRESS = "IN_PROGRESS", _("In Progress")
        COMPLETED = "COMPLETED", _("Completed")
        CANCELLED = "CANCELLED", _("Cancelled")

    production_line = models.ForeignKey(
        ProductionLine,
        on_delete=models.CASCADE,
        related_name="production_schedules",
        verbose_name=_("production line"),
    )
    product = models.ForeignKey(
        "Product",
        on_delete=models.CASCADE,
        related_name="production_schedules",
        blank=True,
        null=True,
        verbose_name=_("product"),
    )
    quantity = models.DecimalField(
        _("quantity"), max_digits=10, decimal_places=2, default=0.00
    )
    start_time = models.DateTimeField(_("start time"), auto_now_add=True)
    end_time = models.DateTimeField(_("end time"), null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=ScheduleStatus.choices,
        default=ScheduleStatus.SCHEDULED,
        verbose_name=_("status"),
    )
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="created_schedules",
        verbose_name=_("created by"),
    )

    class Meta:
        ordering = ["start_time"]
        indexes = [
            models.Index(fields=["production_line", "status"]),
            models.Index(fields=["product", "status"]),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.quantity} units on {self.production_line.name}"

    def clean(self):
        if self.end_time and self.end_time < self.start_time:
            raise ValidationError(_("End time cannot be before start time."))

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


# TODO: Create product tables


class Product(models.Model):
    """
    Product Model

    Relationships:
    - Many-to-Many with ManufacturingProcesses through ProductProcess
    - One-to-Many with ProductionSchedules (a product has many schedules)
    - One-to-Many with QualityControl checks (a product has many QC checks)
    """

    class ProductStatus(models.TextChoices):
        ACTIVE = "ACTIVE", _("Active")
        INACTIVE = "INACTIVE", _("Inactive")
        DISCONTINUED = "DISCONTINUED", _("Discontinued")

    name = models.CharField(_("name"), max_length=100, unique=True)
    code = models.CharField(_("code"), max_length=100, unique=True)
    unit_of_measurement = models.CharField(
        _("unit of measurement"), max_length=50, blank=True, null=True
    )
    specifications = models.JSONField(_("specifications"), default=dict)
    status = models.CharField(
        max_length=20,
        choices=ProductStatus.choices,
        default=ProductStatus.ACTIVE,
        verbose_name=_("status"),
    )
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)
    manufacturing_processes = models.ManyToManyField(
        ManufacturingProcess,
        through="ProductProcess",
        related_name="products",
        blank=True,
        verbose_name=_("manufacturing processes"),
    )

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["code"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"

    def clean(self):
        if self.code and not self.code.isalnum():
            raise ValidationError(_("Code must be alphanumeric."))

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class ProductProcess(models.Model):
    """
    Join table for Product-ManufacturingProcess many-to-many relationship
    with additional sequence field
    """

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="product_processes",
        verbose_name=_("product"),
    )
    process = models.ForeignKey(
        ManufacturingProcess,
        on_delete=models.CASCADE,
        related_name="product_processes",
        verbose_name=_("process"),
    )
    sequence = models.PositiveIntegerField(_("sequence"), default=1)

    class Meta:
        ordering = ["sequence"]
        unique_together = ("product", "process", "sequence")
        indexes = [models.Index(fields=["product", "process"])]

    def __str__(self):
        return f"{self.product.name} -> {self.process.name} (Seq: {self.sequence})"

    def clean(self):
        if self.sequence <= 0:
            raise ValidationError(_("Sequence must be a positive integer."))

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


# # TODO: Create project management tables


class Project(models.Model):
    """
    Project Model

    - Many-to-One with Employee as project manager (a project has one manager) ☑️
    - One-to-Many with Tasks (a project has many tasks) ☑️
    - Many-to-Many with Employees through LaborAllocation (a project can have many employees) ☑️
    """

    class ProjectStatus(models.TextChoices):
        PLANNING = "PLANNING", _("Planning")
        IN_PROGRESS = "IN_PROGRESS", _("In Progress")
        COMPLETED = "COMPLETED", _("Completed")
        ON_HOLD = "ON_HOLD", _("On Hold")
        CANCELLED = "CANCELLED", _("Cancelled")

    name = models.CharField(_("name"), max_length=255, unique=True)
    description = models.TextField(_("description"), blank=True, null=True)
    start_date = models.DateField(_("start date"), auto_now_add=True)
    end_date = models.DateField(_("end date"), null=True, blank=True)
    actual_end_date = models.DateField(_("actual end date"), null=True, blank=True)
    project_status = models.CharField(
        max_length=20,
        choices=ProjectStatus.choices,
        default=ProjectStatus.PLANNING,
        verbose_name=_("project status"),
    )
    project_manager = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_projects",
        verbose_name=_("project manager"),
    )
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        ordering = ["start_date"]
        indexes = [models.Index(fields=["project_manager", "project_status"])]

    def __str__(self):
        return f"{self.name} -> {self.project_manager}"

    def clean(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValidationError(_("End date cannot be before start date."))

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class Task(models.Model):
    """
    Task Model

    - Many-to-One with Project (a task belongs to one project) ☑️
    - Many-to-One with Employee (a task is assigned to one employee) ☑️
    - Many-to-Many with Tasks (self) as dependencies ☑️
    - Many-to-Many with Employees through LaborAllocation (a task can have many employees) ☑️
    """

    class TaskStatus(models.TextChoices):
        PENDING = "PENDING", _("Pending")
        IN_PROGRESS = "IN_PROGRESS", _("In Progress")
        COMPLETED = "COMPLETED", _("Completed")
        BLOCKED = "BLOCKED", _("Blocked")
        CANCELLED = "CANCELLED", _("Cancelled")

    name = models.CharField(_("name"), max_length=255)
    description = models.TextField(_("description"), blank=True, null=True)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="tasks",
        verbose_name=_("project"),
    )
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
        verbose_name=_("assigned to"),
    )
    start_date = models.DateField(_("start date"), auto_now_add=True)
    end_date = models.DateField(_("end date"), null=True, blank=True)
    actual_end_date = models.DateField(_("actual end date"), null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=TaskStatus.choices,
        default=TaskStatus.PENDING,
        verbose_name=_("status"),
    )
    dependencies = models.ManyToManyField(
        "self",
        blank=True,
        symmetrical=False,
        related_name="dependent_tasks",
        verbose_name=_("dependencies"),
    )
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        ordering = ["start_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "project"], name="unique_task_name_per_project"
            ),
        ]
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["assigned_to", "status"]),
        ]

    def __str__(self):
        return f"{self.name} -> {self.project.name}"

    def clean(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValidationError(_("End date cannot be before start date."))

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


# TODO: Create labor allocation tables


class LaborAllocation(models.Model):
    """
    Labor Allocation Model

    - Many-to-One with Employee (an allocation is for one employee) ☑️
    - Many-to-One with Project (optional - an allocation can be for a project) ☑️
    - Many-to-One with Task (optional - an allocation can be for a task) ☑️
    - Many-to-One with ProductionLine (optional - an allocation can be for a production line) ☑️
    """

    employee = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="labor_allocations",
        verbose_name=_("employee"),
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="labor_allocations",
        verbose_name=_("project"),
        null=True,
        blank=True,
    )
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="labor_allocations",
        verbose_name=_("task"),
        null=True,
        blank=True,
    )
    production_line = models.ForeignKey(
        ProductionLine,
        on_delete=models.CASCADE,
        related_name="labor_allocations",
        verbose_name=_("production line"),
        null=True,
        blank=True,
    )
    hours_allocated = models.DecimalField(
        _("hours allocated"), max_digits=10, decimal_places=2, default=0.00
    )
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)
    date = models.DateField(_("date"), default=now)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(project__isnull=False)
                | models.Q(task__isnull=False)
                | models.Q(production_line__isnull=False),
                name="labor_allocation_has_target",
            ),
            models.UniqueConstraint(
                fields=["employee", "date", "project"],
                condition=models.Q(project__isnull=False),
                name="unique_allocation_per_employee_date_project",
            ),
            models.UniqueConstraint(
                fields=["employee", "date", "task"],
                condition=models.Q(task__isnull=False),
                name="unique_allocation_per_employee_date_task",
            ),
            models.UniqueConstraint(
                fields=["employee", "date", "production_line"],
                condition=models.Q(production_line__isnull=False),
                name="unique_allocation_per_employee_date_production_line",
            ),
        ]
        indexes = [
            models.Index(fields=["employee", "date"]),
            models.Index(fields=["project", "date"]),
            models.Index(fields=["task", "date"]),
            models.Index(fields=["production_line", "date"]),
        ]

    def __str__(self):
        if self.task:
            return f"{self.employee.name} - {self.task.name} ({self.date})"
        elif self.production_line:
            return f"{self.employee.name} - {self.production_line.name} ({self.date})"
        return f"{self.employee.name} - {self.project.name} ({self.date})"

    def clean(self):
        if not any([self.project, self.task, self.production_line]):
            raise ValidationError(
                "At least one of project, task, or production line must be specified."
            )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)


class SkillMatrix(models.Model):
    """
    Skill Matrix Model - representing employee skills and competencies.

    - Many-to-One with Employee (a skill entry belongs to one employee) ☑️
    """

    class SkillLevel(models.TextChoices):
        BEGINNER = "BEGINNER", _("Beginner")
        INTERMEDIATE = "INTERMEDIATE", _("Intermediate")
        ADVANCED = "ADVANCED", _("Advanced")
        EXPERT = "EXPERT", _("Expert")

    class SkillCategory(models.TextChoices):
        TECHNICAL = "TECHNICAL", _("Technical")
        MECHANICAL = "MECHANICAL", _("Mechanical")
        ELECTRICAL = "ELECTRICAL", _("Electrical")
        SOFTWARE = "SOFTWARE", _("Software")
        MANAGEMENT = "MANAGEMENT", _("Management")
        ADMINISTRATION = "ADMINISTRATION", _("Administration")
        QUALITY_CONTROL = "QUALITY_CONTROL", _("Quality Control")
        SAFETY = "SAFETY", _("Safety")
        LOGISTICS = "LOGISTICS", _("Logistics")
        MAINTENANCE = "MAINTENANCE", _("Maintenance")
        OPERATIONS = "OPERATIONS", _("Operations")
        DESIGN = "DESIGN", _("Design")
        OTHER = "OTHER", _("Other")

    name = models.CharField(_("name"), max_length=255)
    description = models.TextField(_("description"), blank=True, null=True)
    category = models.CharField(
        max_length=50, choices=SkillCategory.choices, default=SkillCategory.OTHER
    )
    level = models.CharField(
        max_length=50, choices=SkillLevel.choices, default=SkillLevel.BEGINNER
    )
    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name="skills")

    class Meta:
        unique_together = ("employee", "name")
        verbose_name = _("skill matrix")
        verbose_name_plural = _("skill matrices")

    def __str__(self):
        return f"{self.employee.username} - {self.name} -> {self.level}"
